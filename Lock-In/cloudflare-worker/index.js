/**
 * Cloudflare Worker for video processing
 * Triggers the container to process videos into timelapses
 */

export default {
  async fetch(request, env) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle OPTIONS request
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', {
        status: 405,
        headers: corsHeaders,
      });
    }

    try {
      const { videoKey, speedMultiplier = 8, timelapseId } = await request.json();

      if (!videoKey) {
        return new Response(
          JSON.stringify({ error: 'videoKey is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Trigger container to process video
      // Replace CONTAINER_URL with your deployed container URL
      const containerUrl = env.CONTAINER_URL || 'http://your-container.containers.cloud.cloudflare.com';

      const response = await fetch(`${containerUrl}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoKey,
          speedMultiplier,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Processing failed');
      }

      // If timelapseId is provided, update Convex database
      if (timelapseId && env.CONVEX_URL) {
        await fetch(`${env.CONVEX_URL}/api/mutation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Convex-Client': 'cloudflare-worker',
          },
          body: JSON.stringify({
            path: 'timelapses:updateProcessingStatus',
            args: {
              timelapseId,
              status: 'complete',
              processedVideoKey: result.processedVideoKey,
            },
          }),
        });
      }

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Error processing video:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }
  },
};
