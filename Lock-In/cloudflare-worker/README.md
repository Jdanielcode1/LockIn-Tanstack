# Video Processing Worker

Cloudflare Worker that acts as an API endpoint to trigger video processing in the container.

## Setup

1. Install Wrangler CLI:
```bash
npm install -g wrangler
```

2. Login to Cloudflare:
```bash
wrangler login
```

3. Deploy the container first (see `../cloudflare-container/README.md`)

4. Update `wrangler.toml` with your container URL and Convex URL

5. Deploy the worker:
```bash
wrangler deploy
```

## Environment Variables

Set these in your Cloudflare dashboard or wrangler.toml:

- `CONTAINER_URL`: URL of your deployed container
- `CONVEX_URL` (optional): Your Convex deployment URL for status updates

## Usage

Call the worker from your frontend:

```javascript
const response = await fetch('https://your-worker.workers.dev', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    videoKey: 'videos/uuid',
    speedMultiplier: 8,
    timelapseId: 'optional-convex-id'
  }),
});

const result = await response.json();
console.log(result.processedVideoKey);
```

## API

### POST /

Process a video into a timelapse.

Request body:
```json
{
  "videoKey": "videos/uuid",
  "speedMultiplier": 8,
  "timelapseId": "optional-convex-id"
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
