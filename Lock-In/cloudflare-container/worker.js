import { Container } from '@cloudflare/containers';

// Video Processing Container Class
export class VideoProcessor extends Container {
  // Configure default port for the container
  defaultPort = 8080;

  // After 10 minutes of no new activity, shutdown the container
  sleepAfter = '10m';

  // Enable internet access for R2 and Convex
  enableInternet = true;

  constructor(ctx, env) {
    super(ctx, env);

    // Environment variables to pass to the container
    this.envVars = {
      R2_ENDPOINT: env.R2_ENDPOINT,
      R2_ACCESS_KEY_ID: env.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: env.R2_SECRET_ACCESS_KEY,
      R2_BUCKET: env.R2_BUCKET,
      CONVEX_URL: env.CONVEX_URL,
      PORT: "8080"
    };
  }

  // Lifecycle hook called when container starts
  onStart() {
    console.log('Video processor container started!');
  }

  // Lifecycle hook called when container shuts down
  onStop() {
    console.log('Video processor container stopped!');
  }

  // Lifecycle hook called on errors
  onError(error) {
    console.error('Container error:', error);
    throw error;
  }
}

// Worker fetch handler
export default {
  async fetch(request, env) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle OPTIONS request
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Get Durable Object ID (use a consistent ID for the processor)
    // Changed to force fresh instance with updated CONVEX_URL (.convex.site)
    const id = env.VIDEO_PROCESSOR.idFromName("video-processor-with-http-action");
    const stub = env.VIDEO_PROCESSOR.get(id);

    // Forward request to Container - it will automatically start and wait for ports
    const response = await stub.fetch(request);

    // Add CORS headers to response
    const newResponse = new Response(response.body, response);
    Object.keys(corsHeaders).forEach(key => {
      newResponse.headers.set(key, corsHeaders[key]);
    });

    return newResponse;
  },
};
