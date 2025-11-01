# Video Processing Container

FFmpeg-based video processing service for creating timelapses. Runs on Cloudflare Containers.

## Features

- Downloads videos from Cloudflare R2
- Processes with FFmpeg using `setpts` filter to create timelapses
- Uploads processed videos back to R2
- Lightweight Alpine-based Docker image

## Environment Variables

Required environment variables:

```
R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET=your_bucket_name
PORT=8080
```

## API Endpoints

### POST /process

Process a video into a timelapse.

Request body:
```json
{
  "videoKey": "videos/uuid",
  "speedMultiplier": 8
}
```

Response:
```json
{
  "success": true,
  "processedVideoKey": "timelapses/uuid",
  "originalVideoKey": "videos/uuid",
  "speedMultiplier": 8
}
```

### GET /health

Health check endpoint.

## Quick Start - Test Locally

### Option 1: Using Docker (Recommended)

```bash
# 1. Build the image
docker build -t video-processor .

# 2. Set your R2 credentials
export R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
export R2_ACCESS_KEY_ID=your_access_key
export R2_SECRET_ACCESS_KEY=your_secret_key
export R2_BUCKET=your_bucket_name

# 3. Run the test script
./test-local.sh

# 4. Test processing (replace with actual video key from R2)
curl -X POST http://localhost:8080/process \
  -H 'Content-Type: application/json' \
  -d '{"videoKey":"videos/your-test-video.mp4","speedMultiplier":8}'

# 5. Stop container when done
docker stop video-processor-test && docker rm video-processor-test
```

### Option 2: Run Directly with Node

```bash
# Install dependencies
npm install

# Set environment variables
export R2_ENDPOINT=...
export R2_ACCESS_KEY_ID=...
export R2_SECRET_ACCESS_KEY=...
export R2_BUCKET=...

# Run locally
node index.js
```

## Build and Deploy to Cloudflare

```bash
# Build Docker image
docker build -t video-processor .

# Test locally
docker run -p 8080:8080 \
  -e R2_ENDPOINT=$R2_ENDPOINT \
  -e R2_ACCESS_KEY_ID=$R2_ACCESS_KEY_ID \
  -e R2_SECRET_ACCESS_KEY=$R2_SECRET_ACCESS_KEY \
  -e R2_BUCKET=$R2_BUCKET \
  video-processor

# Deploy to Cloudflare Containers
# Follow Cloudflare Containers documentation:
# https://developers.cloudflare.com/containers/
```

## FFmpeg Processing

The service uses the following FFmpeg command to create timelapses:

```bash
ffmpeg -i input.mp4 -vf "setpts=PTS/{speed}" -an output.mp4
```

Where `{speed}` is the speed multiplier (e.g., 8 for 8x faster).

- `setpts=PTS/8`: Speeds up video by 8x
- `-an`: Removes audio (standard for timelapses)
