# Video Processing Integration Architecture

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (React)                               │
│                    VideoUpload.tsx Component                              │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ 1. User uploads video file
                              │    - Uploads to R2 via Convex
                              │    - Creates timelapse record
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         CONVEX DATABASE                                  │
│                    convex/timelapses.ts                                  │
│                                                                           │
│  create() mutation:                                                      │
│  - Creates timelapse record                                              │
│  - Sets processingStatus: "pending"                                      │
│  - Stores original videoKey                                              │
│  - Returns timelapseId                                                   │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ 2. Frontend triggers processing
                              │    POST ${VITE_WORKER_URL}/process
                              │    { videoKey, timelapseId }
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE WORKER                                      │
│              cloudflare-container/worker.js                              │
│                                                                           │
│  POST /process endpoint:                                                 │
│  1. Updates Convex status → "processing"                                 │
│  2. Gets signed video URL from Convex                                    │
│  3. Routes to Container via Durable Object                               │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ 3. Forward request to Container
                              │    POST http://container/process
                              │    { videoUrl, timelapseId }
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE CONTAINER                                  │
│              cloudflare-container/index.js                              │
│                                                                           │
│  POST /process endpoint:                                                 │
│  1. Downloads video from signed URL                                      │
│  2. Analyzes metadata (FFprobe)                                         │
│  3. Calculates optimal sampling rate                                     │
│  4. Processes video with FFmpeg                                         │
│  5. Uploads processed video to R2                                        │
│     └─ Uses improved multipart upload                                    │
│  6. Returns processedVideoKey                                            │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ 4. Container uploads to R2
                              │    uploadVideoToR2() with:
                              │    - Dynamic part sizing
                              │    - Adaptive concurrency
                              │    - Progress tracking
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE R2 STORAGE                                 │
│                                                                           │
│  Timelapse videos stored at:                                            │
│  timelapses/{uuid}.mp4                                                   │
│                                                                           │
│  Metadata includes:                                                      │
│  - timelapse-id                                                          │
│  - upload-method (simple/multipart)                                      │
│  - file-size                                                             │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ 5. Container calls Convex HTTP endpoint
                              │    POST ${CONVEX_URL}/updateProcessingStatus
                              │    { timelapseId, status: "complete", 
                              │      processedVideoKey }
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONVEX HTTP ENDPOINT                                  │
│                    convex/http.ts                                        │
│                                                                           │
│  POST /updateProcessingStatus:                                            │
│  - Validates request                                                     │
│  - Calls internal mutation                                               │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ 6. Internal mutation updates database
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONVEX DATABASE (Updated)                             │
│                    convex/timelapses.ts                                  │
│                                                                           │
│  updateProcessingStatusInternal():                                        │
│  - Updates processingStatus: "complete"                                  │
│  - Sets processedVideoKey                                                │
│  - Updates videoKey to processedVideoKey                                │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              │ 7. Frontend queries Convex
                              │    - Reactively updates UI
                              │    - Shows processed video
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Updated)                             │
│                    Shows completed timelapse                            │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Integration Points

### 1. Frontend → Convex (Initial Upload)

**File:** `src/components/VideoUpload.tsx`

```typescript
// User uploads video
const { timelapseId } = await createTimelapse({
  projectId,
  videoKey,  // Original video uploaded to R2
  durationMinutes,
  requestProcessing: shouldProcess,  // true if needs processing
})

// If processing requested, trigger Worker
if (shouldProcess) {
  fetch(`${workerUrl}/process`, {
    method: 'POST',
    body: JSON.stringify({ videoKey, timelapseId }),
  })
}
```

**Database State:**
```typescript
{
  _id: timelapseId,
  videoKey: "videos/original.mp4",
  originalVideoKey: "videos/original.mp4",
  processingStatus: "pending",
  processedVideoKey: undefined,
}
```

### 2. Worker → Convex (Get Video URL)

**File:** `cloudflare-container/worker.js`

```javascript
// Update status to "processing"
await updateConvexStatus(env, timelapseId, 'processing');

// Get signed URL from Convex
const videoUrl = await getVideoUrl(env, videoKey);
// Calls: POST ${CONVEX_URL}/getVideoUrl
// Returns: Signed R2 URL for video
```

**Convex HTTP Endpoint:** `convex/http.ts`
- `POST /getVideoUrl` - Returns signed R2 URL

### 3. Worker → Container (Process Video)

**File:** `cloudflare-container/worker.js`

```javascript
// Forward to Container via Durable Object
const containerResponse = await stub.fetch(
  new Request('http://container/process', {
    method: 'POST',
    body: JSON.stringify({ videoUrl, timelapseId }),
  })
);
```

**Container Endpoint:** `cloudflare-container/index.js`
- `POST /process` - Processes video and uploads to R2

### 4. Container → R2 (Upload Processed Video)

**File:** `cloudflare-container/index.improved.js`

```javascript
// Process video with FFmpeg
await processVideo(inputPath, outputPath, samplingFps, timelapseId);

// Upload to R2 with improved multipart upload
const processedVideoKey = await uploadVideoToR2(
  outputPath, 
  'timelapses', 
  timelapseId  // For tracking and cancellation
);
```

**R2 Upload Features:**
- Dynamic part sizing (10MB-100MB based on file size)
- Adaptive concurrency (2-8 concurrent uploads)
- Progress tracking
- Metadata tracking (timelapse-id, upload-method)

### 5. Container → Convex (Update Status)

**File:** `cloudflare-container/index.improved.js`

```javascript
// After successful upload
await updateConvexStatus(
  timelapseId, 
  'complete', 
  processedVideoKey
);
```

**Convex HTTP Endpoint:** `convex/http.ts`
- `POST /updateProcessingStatus` - Updates database

**Database State (After Processing):**
```typescript
{
  _id: timelapseId,
  videoKey: "timelapses/processed.mp4",  // Updated to processed video
  originalVideoKey: "videos/original.mp4",
  processedVideoKey: "timelapses/processed.mp4",
  processingStatus: "complete",
}
```

### 6. Frontend → Convex (Query Status)

**File:** `src/routes/_authenticated.projects.$projectId.tsx`

```typescript
// Reactively queries Convex
const timelapses = useQuery(api.timelapses.listByProject, {
  projectId,
});

// UI shows processing status
{timelapse.processingStatus === 'processing' && (
  <div>Processing Your Timelapse...</div>
)}
{timelapse.processingStatus === 'complete' && (
  <VideoPlayer videoKey={timelapse.videoKey} />
)}
```

## Cancellation Flow

```
Frontend → Worker → Container → FFmpeg/Upload
   │         │         │
   │         │         └─ DELETE /process/:timelapseId
   │         │            - Kills FFmpeg process
   │         │            - Aborts multipart upload
   │         │            - Cleans up temp files
   │         │
   │         └─ DELETE /cancel/:timelapseId
   │            - Forwards to Container
   │            - Updates Convex status to "failed"
   │
   └─ handleCancelProcessing()
      - Calls Worker cancel endpoint
      - Updates UI
```

## Environment Variables

### Frontend
```env
VITE_WORKER_URL=https://your-worker.workers.dev
```

### Worker
```env
CONVEX_URL=https://your-convex-deployment.convex.cloud
VIDEO_PROCESSOR=<Durable Object binding>
```

### Container
```env
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<your-access-key>
R2_SECRET_ACCESS_KEY=<your-secret-key>
R2_BUCKET_NAME=<your-bucket-name>
CONVEX_URL=https://your-convex-deployment.convex.cloud
PORT=8080
```

## Error Handling

### Processing Errors
1. **Container processing fails:**
   - Container catches error
   - Calls `updateConvexStatus(timelapseId, 'failed', null, error.message)`
   - Convex updates database
   - Frontend shows error state

2. **Upload fails:**
   - Container aborts multipart upload
   - Cleans up temp files
   - Updates Convex with error

3. **Network errors:**
   - Worker has 5-minute timeout
   - Container has retry logic (adaptive retry mode)
   - Failed uploads are automatically aborted

## Status States

| Status | Description | UI Display |
|--------|-------------|------------|
| `pending` | Queued for processing | "Queued for Processing" |
| `processing` | Currently processing | "Processing Your Timelapse" |
| `complete` | Successfully processed | Shows processed video |
| `failed` | Processing failed | Shows error message |

## Data Flow Summary

1. **Original Video:** Uploaded to R2 → `videos/{uuid}.mp4`
2. **Processed Video:** Created by Container → `timelapses/{uuid}.mp4`
3. **Database:** Tracks both keys and processing status
4. **Frontend:** Shows original while processing, switches to processed when complete

## Benefits of Improved Upload

The improved multipart upload (`index.improved.js`) provides:

1. **Cost Optimization:** Up to 80% reduction in R2 operations for large files
2. **Better Performance:** Adaptive part sizing and concurrency
3. **Cancellation Support:** Can cancel uploads mid-stream
4. **Better Tracking:** Metadata links uploads to timelapse records
5. **Error Recovery:** Automatic cleanup of failed uploads

## Testing the Integration

1. **Upload a video** via VideoUpload component
2. **Check Convex database** - should see `processingStatus: "pending"`
3. **Check Worker logs** - should see processing started
4. **Check Container logs** - should see FFmpeg processing and R2 upload
5. **Check Convex database** - should see `processingStatus: "complete"` with `processedVideoKey`
6. **Check Frontend** - should show processed video

## Monitoring

- **Container logs:** FFmpeg output, upload progress
- **Worker logs:** Status updates, errors
- **Convex logs:** Database mutations
- **R2 dashboard:** Upload operations, storage usage

