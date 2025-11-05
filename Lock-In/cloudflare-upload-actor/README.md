# Cloudflare Upload Actor

A Cloudflare Durable Object (Actor) that handles multipart uploads for large files to R2 storage.

## Features

- **Large File Support**: Upload files up to 5TB
- **Multipart Upload**: Files are split into 10MB chunks for parallel uploading
- **State Management**: SQLite-backed state tracking for each upload
- **Resume Capability**: Automatically resume interrupted uploads
- **Parallel Chunks**: Upload multiple chunks concurrently for faster speeds

## How It Works

1. **Setup**: Client initializes upload with file metadata
2. **Chunking**: Actor calculates parts (10MB each) and stores in SQLite
3. **Upload**: Client uploads parts in parallel via PATCH requests
4. **Tracking**: Actor tracks completed parts in database
5. **Completion**: When all parts uploaded, Actor calls R2's `complete()` method

## API Endpoints

### POST `/setup`
Initialize a new multipart upload.

**Request Body:**
```json
{
  "fileName": "video.mp4",
  "fileSize": 524288000
}
```

**Response:**
```json
{
  "uploadId": "abc123",
  "key": "videos/1234567890-video.mp4"
}
```

### GET `/status`
Get current upload status.

**Response:**
```json
{
  "fileName": "video.mp4",
  "fileSize": 524288000,
  "key": "videos/1234567890-video.mp4",
  "uploadId": "abc123",
  "totalParts": 50,
  "completedParts": 25,
  "missingParts": [...]
}
```

### GET `/missing`
Get list of parts that still need to be uploaded.

**Response:**
```json
{
  "missingParts": [
    {"partNumber": 1, "partStart": 0, "partEnd": 10485760},
    {"partNumber": 2, "partStart": 10485760, "partEnd": 20971520}
  ]
}
```

### PATCH `/part/:partNumber`
Upload a single part.

**Request Body:** Binary data (part content)

**Response:**
```json
{
  "success": true,
  "remainingCount": 24,
  "completed": false,
  "partNumber": 1
}
```

When last part is uploaded:
```json
{
  "success": true,
  "remainingCount": 0,
  "completed": true,
  "key": "videos/1234567890-video.mp4",
  "etag": "\"abc123-50\""
}
```

### DELETE `/abort`
Abort the multipart upload and clean up.

**Response:**
```json
{
  "success": true,
  "message": "Upload aborted"
}
```

## Deployment

### Prerequisites

1. Cloudflare account with Workers and R2 enabled
2. R2 bucket created (e.g., `lock-in-bucket-2`)
3. Wrangler CLI installed

### Steps

1. Install dependencies:
```bash
npm install
```

2. Update `wrangler.toml` with your bucket name:
```toml
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "your-bucket-name"
```

3. Deploy to Cloudflare:
```bash
npm run deploy
```

4. Copy the deployed URL and add to your frontend `.env`:
```env
VITE_UPLOAD_ACTOR_URL=https://lock-in-upload-actor.your-subdomain.workers.dev
```

## Development

### Local Development
```bash
npm run dev
```

### View Logs
```bash
npm run tail
```

## Architecture

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ 1. Initialize upload
       ├─────────────────────────┐
       │                         │
       │  ┌──────────────────────▼────────────┐
       │  │  Cloudflare Upload Actor          │
       │  │  (Durable Object)                 │
       │  │                                   │
       │  │  ┌─────────────────────────────┐ │
       │  │  │  SQLite Storage             │ │
       │  │  │  - Track parts              │ │
       │  │  │  - Upload state             │ │
       │  │  └─────────────────────────────┘ │
       │  │                                   │
       │  └──────────┬────────────────────────┘
       │             │ 3. Upload parts to R2
       │  2. Upload  │
       │  parts      ▼
       │  (parallel) ┌──────────────────────────┐
       └────────────►│  Cloudflare R2 Storage   │
                     └──────────────────────────┘
```

## Technical Details

### Part Size
- Default: 10MB per part
- Minimum: 5MB (R2 requirement)
- Last part: Can be any size

### Concurrency
- Frontend: 5 concurrent part uploads
- Configurable in `multipartUpload.ts`

### State Persistence
- Uses SQLite for part tracking
- Survives Actor hibernation
- Automatic resume on reconnect

### Error Handling
- Retries on transient failures
- Abort on unrecoverable errors
- Clean state cleanup on abort

## Limitations

- Maximum file size: 5TB (R2 limit)
- Maximum parts: 10,000 (R2 limit)
- Part size range: 5MB - 5GB

## Cost Considerations

**Durable Object Costs:**
- Requests: ~$0.15 per million requests
- Duration: ~$12.50 per million GB-seconds
- Storage: $0.20 per GB-month (for SQLite state)

**R2 Costs:**
- Storage: $0.015 per GB-month
- Class A Operations (multipart): $4.50 per million
- Class B Operations: Free

For a 1GB file (100 parts):
- ~100 Actor requests: $0.000015
- ~100 R2 operations: $0.00045
- Total: Less than $0.001 per upload

## Troubleshooting

### Upload fails immediately
- Check VITE_UPLOAD_ACTOR_URL is set correctly
- Verify R2 bucket exists and is accessible
- Check browser console for error messages

### Upload stalls mid-way
- Check network connectivity
- Verify Actor is not rate-limited
- Check Cloudflare dashboard for errors

### Parts upload but don't complete
- Verify all parts are uploaded (check `/status`)
- Ensure part numbers are sequential starting from 1
- Check Actor logs for R2 complete() errors

## Links

- [Cloudflare Actors Documentation](https://developers.cloudflare.com/durable-objects/actors/)
- [R2 Multipart Upload](https://developers.cloudflare.com/r2/api/workers/workers-multipart-usage/)
- [Durable Objects Pricing](https://developers.cloudflare.com/workers/platform/pricing/#durable-objects)
