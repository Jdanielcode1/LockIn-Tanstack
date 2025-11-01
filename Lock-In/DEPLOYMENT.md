# Cloudflare Video Processing Deployment Guide

This guide walks you through deploying the server-side video processing infrastructure for Lock-In using Cloudflare Containers and Workers.

## Architecture Overview

```
User Upload → R2 Storage → Cloudflare Worker → Container (FFmpeg) → R2 Storage → Convex DB Update
```

## Prerequisites

- Cloudflare account with Containers beta access
- Wrangler CLI installed: `npm install -g wrangler`
- Docker installed
- Cloudflare R2 bucket created
- Convex project deployed

## Step 1: Deploy the FFmpeg Container

### 1.1 Build the Docker Image

```bash
cd cloudflare-container
docker build -t video-processor .
```

### 1.2 Test Locally (Optional)

```bash
# Set environment variables
export R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
export R2_ACCESS_KEY_ID=your_access_key
export R2_SECRET_ACCESS_KEY=your_secret_key
export R2_BUCKET=your_bucket_name

# Run container
docker run -p 8080:8080 \
  -e R2_ENDPOINT=$R2_ENDPOINT \
  -e R2_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID \
  -e R2_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY \
  -e R2_BUCKET=$R2_BUCKET \
  video-processor

# Test endpoint
curl http://localhost:8080/health
```

### 1.3 Deploy to Cloudflare Containers

Follow the official [Cloudflare Containers documentation](https://developers.cloudflare.com/containers/):

```bash
# Login to Cloudflare
wrangler login

# Push image to Cloudflare (exact commands depend on Cloudflare Containers CLI)
# This will give you a container URL like: https://xxx.containers.cloud.cloudflare.com
```

### 1.4 Set Environment Variables

In the Cloudflare dashboard, set these environment variables for your container:

- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `PORT=8080`

## Step 2: Deploy the Cloudflare Worker

### 2.1 Update Configuration

Edit `cloudflare-worker/wrangler.toml`:

```toml
name = "video-processor-worker"
main = "index.js"
compatibility_date = "2024-01-01"

[vars]
CONTAINER_URL = "https://your-container.containers.cloud.cloudflare.com"
CONVEX_URL = "https://your-project.convex.cloud"
```

### 2.2 Deploy Worker

```bash
cd cloudflare-worker
wrangler deploy
```

This will output a Worker URL like: `https://video-processor-worker.your-account.workers.dev`

## Step 3: Update Frontend Configuration

### 3.1 Add Environment Variable

Create or update `.env.local` in your project root:

```bash
VITE_WORKER_URL=https://video-processor-worker.your-account.workers.dev
```

### 3.2 Restart Dev Server

```bash
npm run dev
```

## Step 4: Testing the Flow

1. **Upload a Video**:
   - Navigate to a project
   - Click "Upload Timelapse"
   - Select a video file
   - Check "Create timelapse (server-side processing)"
   - Choose speed multiplier (e.g., 8x)
   - Click Upload

2. **Monitor Processing**:
   - Check Cloudflare dashboard for container logs
   - Check Worker logs: `wrangler tail` in cloudflare-worker directory
   - Check Convex dashboard for database updates

3. **Verify Result**:
   - Video should appear with "Processing" badge initially
   - After processing completes, processed video should be visible
   - Original video is preserved in `originalVideoKey` field

## Architecture Details

### Upload Flow

1. User selects video and checks "Create timelapse"
2. Frontend uploads original video to R2
3. Frontend creates timelapse record in Convex with `processingStatus: "pending"`
4. Frontend calls Cloudflare Worker with video key and speed multiplier
5. Worker triggers Container to process video
6. Container downloads from R2, processes with FFmpeg, uploads to R2
7. Container returns processed video key
8. Worker updates Convex record with `processingStatus: "complete"`

### FFmpeg Processing

The container uses this FFmpeg command:

```bash
ffmpeg -i input.mp4 -vf "setpts=PTS/{speed}" -an output.mp4
```

Where `{speed}` is the multiplier (e.g., 8 for 8x faster).

- `setpts=PTS/8`: Speeds up video by adjusting presentation timestamps
- `-an`: Removes audio (standard for timelapses)

### Database Schema

```typescript
timelapses: {
  videoKey: string              // Main video (processed or original)
  originalVideoKey?: string     // Original before processing
  processedVideoKey?: string    // Timelapse after processing
  processingStatus?: "pending" | "processing" | "complete" | "failed"
  processingError?: string      // Error message if failed
  speedMultiplier?: number      // How much faster (2x, 4x, 8x, etc)
  originalDuration?: number     // Duration before processing
}
```

## Monitoring and Debugging

### Container Logs

View container logs in Cloudflare dashboard or:

```bash
# If Cloudflare provides CLI access to container logs
wrangler containers logs video-processor
```

### Worker Logs

```bash
cd cloudflare-worker
wrangler tail
```

### Common Issues

1. **Processing takes too long**:
   - Large videos may take several minutes
   - Consider adding timeout handling
   - Check container resource limits

2. **Out of memory**:
   - Increase container instance size (from dev to basic or standard)
   - Process videos in chunks for very large files

3. **R2 access denied**:
   - Verify R2 credentials are correct
   - Check bucket permissions
   - Ensure endpoint URL is correct

## Cost Optimization

For a hackathon, costs should be minimal:

- **Cloudflare Workers**: Free tier covers most usage
- **Cloudflare Containers**: Pay only when processing (scale-to-zero)
- **R2 Storage**: Very cheap ($0.015/GB/month)

Estimated cost for 100 video uploads: **< $5/month**

## Future Enhancements

1. **Add webhook/polling** for processing status updates
2. **Add progress tracking** during FFmpeg processing
3. **Support multiple output formats** (GIF, WebM, etc)
4. **Batch processing** for multiple videos
5. **Thumbnail generation** during processing
6. **Automatic cleanup** of original videos after processing
