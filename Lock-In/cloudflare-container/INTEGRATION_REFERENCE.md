# Quick Reference: Video Processing Integration Files

## File Structure & Responsibilities

```
lockin-tanstack/Lock-In/
│
├── src/components/
│   └── VideoUpload.tsx                    # Frontend upload component
│       ├── Uploads video to R2 via Convex
│       ├── Creates timelapse record
│       └── Triggers Worker for processing
│
├── convex/
│   ├── timelapses.ts                       # Database mutations/queries
│   │   ├── create()                        # Creates timelapse record
│   │   ├── updateProcessingStatus()         # Public mutation
│   │   └── updateProcessingStatusInternal() # Called from HTTP endpoint
│   │
│   ├── http.ts                             # HTTP endpoints for external services
│   │   ├── POST /updateProcessingStatus     # Updates processing status
│   │   ├── POST /getVideoUrl                # Returns signed R2 URL
│   │   └── POST /updateThumbnail            # Updates thumbnail
│   │
│   └── r2.ts                               # R2 operations
│       └── getVideoUrlInternal()           # Gets signed URL for video
│
├── cloudflare-container/
│   ├── worker.js                           # Cloudflare Worker (routing layer)
│   │   ├── POST /process                   # Routes to Container
│   │   ├── DELETE /cancel/:timelapseId     # Cancels processing
│   │   └── POST /generate-thumbnail        # AI thumbnail generation
│   │
│   ├── index.js                            # Container (current implementation)
│   │   ├── POST /process                   # Processes video
│   │   ├── DELETE /process/:timelapseId     # Cancels processing
│   │   └── POST /extract-frames            # Extracts frames for thumbnails
│   │
│   └── index.improved.js                   # Container (improved implementation)
│       ├── ✅ Dynamic part sizing
│       ├── ✅ Adaptive concurrency
│       ├── ✅ Upload cancellation
│       └── ✅ Enhanced error handling
│
└── src/routes/
    ├── _authenticated.projects.$projectId.tsx  # Shows timelapses list
    └── _authenticated.timelapse.$timelapseId.tsx # Shows single timelapse
```

## API Endpoints

### Frontend → Worker
```
POST ${VITE_WORKER_URL}/process
Body: { videoKey: string, timelapseId: string }
```

### Worker → Container
```
POST http://container/process
Body: { videoUrl: string, timelapseId: string }
```

### Container → Convex
```
POST ${CONVEX_URL}/updateProcessingStatus
Body: { 
  timelapseId: string,
  status: "pending" | "processing" | "complete" | "failed",
  processedVideoKey?: string,
  error?: string
}
```

### Frontend → Worker (Cancel)
```
DELETE ${VITE_WORKER_URL}/cancel/:timelapseId
```

### Worker → Container (Cancel)
```
DELETE http://container/process/:timelapseId
```

## Database Schema

```typescript
timelapses: {
  _id: Id<"timelapses">
  userId: Id<"users">
  projectId: Id<"projects">
  videoKey: string                    // Current video (processed if available)
  originalVideoKey?: string           // Original uploaded video
  processedVideoKey?: string           // Processed timelapse video
  thumbnailKey?: string
  processingStatus?: "pending" | "processing" | "complete" | "failed"
  processingError?: string
  durationMinutes: number
  // ... other fields
}
```

## Status Flow

```
pending → processing → complete
   │           │
   └───────────┴──→ failed
```

## Key Functions

### Frontend (VideoUpload.tsx)
- `handleSubmit()` - Uploads video and triggers processing
- `handleCancel()` - Cancels upload/processing

### Convex (timelapses.ts)
- `create()` - Creates timelapse record
- `updateProcessingStatusInternal()` - Updates status from external services

### Worker (worker.js)
- `updateConvexStatus()` - Updates Convex via HTTP endpoint
- `getVideoUrl()` - Gets signed R2 URL from Convex

### Container (index.js / index.improved.js)
- `processVideo()` - FFmpeg video processing
- `uploadVideoToR2()` - Uploads to R2 (improved in index.improved.js)
- `updateConvexStatus()` - Updates Convex via HTTP endpoint

## Integration Checklist

- [ ] Frontend uploads video to R2
- [ ] Convex creates timelapse record with `processingStatus: "pending"`
- [ ] Frontend triggers Worker `/process` endpoint
- [ ] Worker updates status to "processing"
- [ ] Worker gets signed video URL from Convex
- [ ] Worker forwards to Container `/process`
- [ ] Container downloads video
- [ ] Container processes with FFmpeg
- [ ] Container uploads processed video to R2 (with improved multipart)
- [ ] Container updates Convex status to "complete"
- [ ] Frontend reactively shows processed video

## Troubleshooting

### Processing stuck in "pending"
- Check Worker logs for errors
- Verify `VITE_WORKER_URL` is set correctly
- Check Worker is deployed and accessible

### Processing stuck in "processing"
- Check Container logs for FFmpeg errors
- Verify R2 credentials are correct
- Check Container has enough resources

### Upload fails
- Check R2 bucket permissions
- Verify R2 credentials
- Check file size limits (500MB processing limit)
- Review Container logs for multipart upload errors

### Status not updating
- Check Convex HTTP endpoint is accessible
- Verify `CONVEX_URL` is set correctly in Container
- Check Convex logs for errors



