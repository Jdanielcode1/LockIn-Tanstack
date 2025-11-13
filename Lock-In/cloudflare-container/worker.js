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

// Helper: Fetch with timeout
async function fetchWithTimeout(promise, timeoutMs, timeoutErrorMsg = 'Request timed out') {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutErrorMsg));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
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
      'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
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

        // 🔄 Phase 4: Get Durable Object per-timelapseId for concurrent processing
        const id = env.VIDEO_PROCESSOR.idFromName(`thumbnail-${timelapseId}`);
        const stub = env.VIDEO_PROCESSOR.get(id);
        console.log(`Using Durable Object instance: thumbnail-${timelapseId}`);

        // Extract frames from container with 2 minute timeout
        const extractResponse = await fetchWithTimeout(
          stub.fetch(
            new Request('http://container/extract-frames', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ videoUrl }),
            })
          ),
          2 * 60 * 1000, // 2 minutes
          'Frame extraction timed out after 2 minutes'
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
      let timelapseId; // Declare in outer scope for catch block
      try {
        const body = await request.json();
        const { videoKey } = body;
        timelapseId = body.timelapseId;

        if (!videoKey || !timelapseId) {
          return new Response(
            JSON.stringify({ error: 'videoKey and timelapseId are required' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        console.log(`Processing video: ${videoKey} with intelligent timelapse`);

        // Update status to "processing"
        await updateConvexStatus(env, timelapseId, 'processing');

        // Get signed URL from Convex
        const videoUrl = await getVideoUrl(env, videoKey);
        console.log('Got video URL from Convex');

        // 🔄 Phase 4: Get Durable Object per-timelapseId for concurrent processing
        const id = env.VIDEO_PROCESSOR.idFromName(`process-${timelapseId}`);
        const stub = env.VIDEO_PROCESSOR.get(id);
        console.log(`Using Durable Object instance: process-${timelapseId}`);

        // Forward to container with videoUrl, with 5 minute timeout
        const containerResponse = await fetchWithTimeout(
          stub.fetch(
            new Request('http://container/process', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ videoUrl, timelapseId }),
            })
          ),
          5 * 60 * 1000, // 5 minutes
          'Video processing timed out after 5 minutes'
        );

        if (!containerResponse.ok) {
          const errorText = await containerResponse.text();
          throw new Error(`Container processing failed: ${errorText}`);
        }

        const { processedVideoKey, speedMultiplier, estimatedOutputDuration, samplingFps } = await containerResponse.json();
        console.log(`Container processed video successfully (${speedMultiplier}x speed, ~${estimatedOutputDuration}s output), uploaded to R2: ${processedVideoKey}`);

        // Update Convex with success
        await updateConvexStatus(env, timelapseId, 'complete', processedVideoKey);

        return new Response(
          JSON.stringify({
            success: true,
            processedVideoKey,
            samplingFps,
          }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      } catch (error) {
        console.error('Processing error:', error);

        // Update Convex with failure if we have timelapseId
        if (timelapseId) {
          await updateConvexStatus(env, timelapseId, 'failed', null, error.message);
        }

        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    // Cancel processing endpoint
    if (url.pathname.startsWith('/cancel/') && request.method === 'DELETE') {
      try {
        const timelapseId = url.pathname.split('/cancel/')[1];

        if (!timelapseId) {
          return new Response(
            JSON.stringify({ error: 'timelapseId is required' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        console.log(`Cancelling processing for timelapse: ${timelapseId}`);

        // 🔄 Phase 4: Get the specific Durable Object instance for this timelapse
        const id = env.VIDEO_PROCESSOR.idFromName(`process-${timelapseId}`);
        const stub = env.VIDEO_PROCESSOR.get(id);
        console.log(`Cancelling Durable Object instance: process-${timelapseId}`);

        // Forward cancellation request to container
        const cancelResponse = await stub.fetch(
          new Request(`http://container/process/${timelapseId}`, {
            method: 'DELETE',
          })
        );

        if (!cancelResponse.ok) {
          const errorText = await cancelResponse.text();
          console.error(`Cancellation failed: ${errorText}`);
          return new Response(
            JSON.stringify({ error: `Cancellation failed: ${errorText}` }),
            { status: cancelResponse.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        // Update Convex status to cancelled
        await updateConvexStatus(env, timelapseId, 'failed', null, 'Processing cancelled by user');

        console.log(`Successfully cancelled processing for timelapse: ${timelapseId}`);

        return new Response(
          JSON.stringify({ success: true, message: 'Processing cancelled successfully' }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      } catch (error) {
        console.error('Cancellation error:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    // 🔶 Phase 6: Process single chunk endpoint (parallel processing)
    if (url.pathname === '/process-chunk' && request.method === 'POST') {
      try {
        const { chunkKey, chunkIndex, jobId, samplingFps } = await request.json();

        if (!chunkKey || chunkIndex === undefined || !jobId || !samplingFps) {
          return new Response(
            JSON.stringify({ error: 'chunkKey, chunkIndex, jobId, and samplingFps are required' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        console.log(`🔶 Worker: Processing chunk ${chunkIndex} for job ${jobId}`);

        // Get signed URL for chunk from R2
        const chunkUrl = await getVideoUrl(env, chunkKey);
        console.log(`Got signed URL for chunk ${chunkIndex}`);

        // 🔶 Phase 6: Use unique Durable Object per chunk for parallel processing
        // This enables multiple chunks to be processed simultaneously across different containers
        const id = env.VIDEO_PROCESSOR.idFromName(`chunk-${jobId}-${chunkIndex}`);
        const stub = env.VIDEO_PROCESSOR.get(id);
        console.log(`Using Durable Object instance: chunk-${jobId}-${chunkIndex}`);

        // Forward to container with 10 minute timeout (chunks are smaller, but allow buffer)
        const containerResponse = await fetchWithTimeout(
          stub.fetch(
            new Request('http://container/process-chunk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chunkUrl, chunkIndex, jobId, samplingFps }),
            })
          ),
          10 * 60 * 1000, // 10 minutes
          `Chunk ${chunkIndex} processing timed out after 10 minutes`
        );

        if (!containerResponse.ok) {
          const errorText = await containerResponse.text();
          throw new Error(`Chunk ${chunkIndex} processing failed: ${errorText}`);
        }

        const result = await containerResponse.json();
        console.log(`✅ Chunk ${chunkIndex} processed successfully: ${result.processedKey}`);

        return new Response(
          JSON.stringify(result),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );

      } catch (error) {
        console.error('Chunk processing error:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    // 🔶 Phase 6: Stitch chunks endpoint (called by Convex after all chunks are processed)
    if (url.pathname === '/stitch' && request.method === 'POST') {
      try {
        const { jobId, processedChunkKeys } = await request.json();

        if (!jobId || !processedChunkKeys || !Array.isArray(processedChunkKeys)) {
          return new Response(
            JSON.stringify({ error: 'jobId and processedChunkKeys (array) are required' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        console.log(`🔶 Worker: Stitching ${processedChunkKeys.length} chunks for job ${jobId}`);

        // Use a single Durable Object for stitching (not parallelized)
        const id = env.VIDEO_PROCESSOR.idFromName(`stitch-${jobId}`);
        const stub = env.VIDEO_PROCESSOR.get(id);
        console.log(`Using Durable Object instance: stitch-${jobId}`);

        // Forward to container with 15 minute timeout (stitching can take time for large videos)
        const containerResponse = await fetchWithTimeout(
          stub.fetch(
            new Request('http://container/stitch-chunks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jobId, processedChunkKeys }),
            })
          ),
          15 * 60 * 1000, // 15 minutes
          `Stitching timed out after 15 minutes`
        );

        if (!containerResponse.ok) {
          const errorText = await containerResponse.text();
          throw new Error(`Stitching failed: ${errorText}`);
        }

        const result = await containerResponse.json();
        console.log(`✅ Stitching completed successfully: ${result.finalVideoKey}`);

        return new Response(
          JSON.stringify(result),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );

      } catch (error) {
        console.error('Stitching error:', error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    // License acceptance endpoint
    if (url.pathname === '/accept-ai-license' && request.method === 'POST') {
      try {
        console.log('Accepting Llama 3.2 Vision AI license...');

        // Submit 'agree' to accept the license using the correct API format
        const response = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
          prompt: 'agree'
        });

        console.log('License acceptance response:', response);

        return new Response(
          JSON.stringify({ success: true, message: 'AI license accepted', response }),
          { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      } catch (error) {
        // Check if this is the "success" error message
        if (error.message && error.message.includes('Thank you for agreeing')) {
          console.log('License accepted successfully!');
          return new Response(
            JSON.stringify({ success: true, message: 'AI license accepted successfully' }),
            { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        console.error('Error accepting AI license:', error);
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
