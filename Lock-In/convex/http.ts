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

export default http;
