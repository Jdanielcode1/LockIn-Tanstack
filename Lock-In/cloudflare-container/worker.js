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
      R2_BUCKET_NAME: env.R2_BUCKET_NAME,
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

// Helper: Upload base64 image to R2
async function uploadThumbnailToR2(env, base64Data, prefix = 'thumbnails') {
  const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
  const key = `${prefix}/${crypto.randomUUID()}.jpg`;

  await env.R2_BUCKET.put(key, imageBuffer, {
    httpMetadata: {
      contentType: 'image/jpeg',
    },
  });

  return key;
}

// Helper: Update Convex with thumbnail
async function updateConvexThumbnail(env, timelapseId, thumbnailKey) {
  const convexUrl = env.CONVEX_URL;

  try {
    const response = await fetch(`${convexUrl}/updateThumbnail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timelapseId, thumbnailKey }),
    });

    if (!response.ok) {
      console.error('Failed to update Convex with thumbnail:', await response.text());
    } else {
      console.log('Successfully updated Convex with thumbnail:', thumbnailKey);
    }
  } catch (err) {
    console.error('Error updating Convex thumbnail:', err);
  }
}

// Helper: Get signed video URL from Convex
async function getVideoUrl(env, videoKey) {
  const convexUrl = env.CONVEX_URL;

  try {
    const response = await fetch(`${convexUrl}/getVideoUrl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoKey }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get video URL: ${await response.text()}`);
    }

    const data = await response.json();
    return data.url;
  } catch (err) {
    console.error('Error getting video URL:', err);
    throw err;
  }
}

// Helper: Update Convex processing status
async function updateConvexStatus(env, timelapseId, status, processedVideoKey = null, error = null) {
  const convexUrl = env.CONVEX_URL;

  try {
    const payload = {
      timelapseId,
      status,
      ...(processedVideoKey && { processedVideoKey }),
      ...(error && { error }),
    };

    const response = await fetch(`${convexUrl}/updateProcessingStatus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('Failed to update Convex status:', await response.text());
    } else {
      console.log('Successfully updated Convex status to:', status);
    }
  } catch (err) {
    console.error('Error updating Convex status:', err);
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

    const url = new URL(request.url);

    // AI thumbnail generation endpoint
    if (url.pathname === '/generate-thumbnail' && request.method === 'POST') {
      try {
        const { videoKey, timelapseId } = await request.json();

        if (!videoKey || !timelapseId) {
          return new Response(
            JSON.stringify({ error: 'videoKey and timelapseId are required' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        console.log(`Generating AI thumbnail for video: ${videoKey}`);

        // Get signed URL from Convex
        const videoUrl = await getVideoUrl(env, videoKey);
        console.log('Got video URL from Convex');

        // Get Durable Object to extract frames
        const id = env.VIDEO_PROCESSOR.idFromName("video-processor-ai-thumbnails");
        const stub = env.VIDEO_PROCESSOR.get(id);

        // Extract frames from container
        const extractResponse = await stub.fetch(
          new Request('http://container/extract-frames', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoUrl }),
          })
        );

        if (!extractResponse.ok) {
          throw new Error(`Frame extraction failed: ${await extractResponse.text()}`);
        }

        const { frames } = await extractResponse.json();
        console.log(`Extracted ${frames.length} frames, analyzing with AI...`);

        // Analyze each frame with Cloudflare AI
        const analyses = await Promise.all(
          frames.map(async (frame, index) => {
            try {
              const aiResponse = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
                messages: [
                  {
                    role: 'user',
                    content: [
                      {
                        type: 'text',
                        text: 'Rate this image for visual interest and activity level from 1-10. Consider clarity, composition, and whether it shows meaningful work activity. Respond with ONLY a number between 1 and 10.'
                      },
                      {
                        type: 'image_url',
                        image_url: { url: `data:image/jpeg;base64,${frame.base64}` }
                      }
                    ]
                  }
                ]
              });

              // Extract numeric score from response
              const scoreMatch = aiResponse.response.match(/\d+/);
              const score = scoreMatch ? parseInt(scoreMatch[0]) : 5;

              console.log(`Frame ${index + 1} (${frame.timestamp * 100}%) scored: ${score}/10`);

              return { frame, score, index };
            } catch (error) {
              console.error(`AI analysis failed for frame ${index}:`, error);
              return { frame, score: 5, index }; // Default score on error
            }
          })
        );

        // Pick the best frame
        const bestFrame = analyses.reduce((best, current) =>
          current.score > best.score ? current : best
        );

        console.log(`Best frame: ${bestFrame.index + 1} with score ${bestFrame.score}/10`);

        // Upload best frame to R2
        const thumbnailKey = await uploadThumbnailToR2(env, bestFrame.frame.base64);
        console.log(`Uploaded thumbnail to R2: ${thumbnailKey}`);

        // Update Convex with thumbnail
        await updateConvexThumbnail(env, timelapseId, thumbnailKey);

        return new Response(
          JSON.stringify({
            success: true,
            thumbnailKey,
            score: bestFrame.score,
            selectedFrame: bestFrame.index + 1,
          }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      } catch (error) {
        console.error('Thumbnail generation error:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    // Video processing endpoint
    if (url.pathname === '/process' && request.method === 'POST') {
      try {
        const { videoKey, speedMultiplier, timelapseId } = await request.json();

        if (!videoKey || !timelapseId) {
          return new Response(
            JSON.stringify({ error: 'videoKey and timelapseId are required' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        console.log(`Processing video: ${videoKey}`);

        // Update status to "processing"
        await updateConvexStatus(env, timelapseId, 'processing');

        // Get signed URL from Convex
        const videoUrl = await getVideoUrl(env, videoKey);
        console.log('Got video URL from Convex');

        // Get Durable Object
        const id = env.VIDEO_PROCESSOR.idFromName("video-processor-ai-thumbnails");
        const stub = env.VIDEO_PROCESSOR.get(id);

        // Forward to container with videoUrl
        const containerResponse = await stub.fetch(
          new Request('http://container/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoUrl, speedMultiplier, timelapseId }),
          })
        );

        if (!containerResponse.ok) {
          const errorText = await containerResponse.text();
          throw new Error(`Container processing failed: ${errorText}`);
        }

        const { videoBase64 } = await containerResponse.json();
        console.log('Received processed video from container');

        // Decode base64 and upload to R2
        const videoBuffer = Uint8Array.from(atob(videoBase64), c => c.charCodeAt(0));
        const processedKey = `timelapses/${crypto.randomUUID()}.mp4`;

        console.log('Uploading processed video to R2:', processedKey);
        await env.R2_BUCKET.put(processedKey, videoBuffer, {
          httpMetadata: {
            contentType: 'video/mp4',
          },
        });

        // Update Convex with success
        await updateConvexStatus(env, timelapseId, 'complete', processedKey);

        return new Response(
          JSON.stringify({
            success: true,
            processedVideoKey: processedKey,
            speedMultiplier,
          }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      } catch (error) {
        console.error('Processing error:', error);

        // Update Convex with failure
        if (request.json && request.json.timelapseId) {
          await updateConvexStatus(env, request.json.timelapseId, 'failed', null, error.message);
        }

        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    // Default: Forward to container
    const id = env.VIDEO_PROCESSOR.idFromName("video-processor-ai-thumbnails");
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
