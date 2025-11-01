import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

const http = httpRouter();

// HTTP endpoint for external services to update processing status
http.route({
  path: "/updateProcessingStatus",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Parse request body
    const body = await request.json();

    // Validate required fields
    if (!body.timelapseId || !body.status) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "timelapseId and status are required"
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    try {
      // Call the internal mutation to update the database
      await ctx.runMutation(internal.timelapses.updateProcessingStatusInternal, {
        timelapseId: body.timelapseId,
        status: body.status,
        processedVideoKey: body.processedVideoKey,
        error: body.error,
      });

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    } catch (error: any) {
      console.error("Error updating processing status:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  }),
});

// HTTP endpoint for external services to update thumbnail
http.route({
  path: "/updateThumbnail",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Parse request body
    const body = await request.json();

    // Validate required fields
    if (!body.timelapseId || !body.thumbnailKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "timelapseId and thumbnailKey are required"
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    try {
      // Call the internal mutation to update the database
      await ctx.runMutation(internal.timelapses.updateThumbnailInternal, {
        timelapseId: body.timelapseId,
        thumbnailKey: body.thumbnailKey,
      });

      return new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    } catch (error: any) {
      console.error("Error updating thumbnail:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  }),
});

// HTTP endpoint to get signed URL for video
http.route({
  path: "/getVideoUrl",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();

    if (!body.videoKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "videoKey is required"
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    try {
      const url = await ctx.runQuery(internal.r2.getVideoUrlInternal, {
        videoKey: body.videoKey,
      });

      return new Response(
        JSON.stringify({ success: true, url }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    } catch (error: any) {
      console.error("Error getting video URL:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  }),
});

export default http;
