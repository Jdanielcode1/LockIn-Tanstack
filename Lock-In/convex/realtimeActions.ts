import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

// Initialize a RealtimeKit meeting for a Lock In Session
export const initializeMeeting = action({
  args: {
    sessionId: v.id("lockInSessions"),
    userId: v.id("users"),
  },
  returns: v.object({
    success: v.boolean(),
    meetingId: v.optional(v.string()),
    authToken: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Get RealtimeKit credentials from Convex environment
    const realtimeKitAppId = process.env.REALTIMEKIT_APP_ID!;
    const realtimeKitApiToken = process.env.REALTIMEKIT_API_TOKEN!;

    console.log("Using RealtimeKit App ID:", realtimeKitAppId);

    try {
      // Fetch session details
      const session = await ctx.runQuery(api.lockInSessions.get, {
        sessionId: args.sessionId,
      });

      if (!session) {
        return { success: false, error: "Session not found" };
      }

      // Check if user is authorized (creator or participant)
      if (session.creatorId !== args.userId) {
        const participants = await ctx.runQuery(
          api.lockInSessions.getParticipants,
          {
            sessionId: args.sessionId,
          }
        );

        const isParticipant = participants.some(
          (p: { userId: string }) => p.userId === args.userId
        );
        if (!isParticipant) {
          return { success: false, error: "Not authorized" };
        }
      }

      // For now, generate a placeholder meeting ID
      // The actual WebRTC session will be created client-side using the RealtimeKit SDK
      // This server-side action just initializes the session in our database
      const meetingId = `rtk-${args.sessionId}-${Date.now()}`;
      const authToken = realtimeKitApiToken;

      // In a production implementation, you would:
      // 1. Client creates RTCPeerConnection and generates offer SDP
      // 2. Client sends offer SDP to this action
      // 3. Action forwards offer to RealtimeKit API
      // 4. RealtimeKit returns answer SDP
      // 5. Action returns answer SDP to client
      // 6. Client completes WebRTC connection

      // Update session with meeting details
      await ctx.runMutation(api.lockInSessions.start, {
        sessionId: args.sessionId,
        realtimeKitMeetingId: meetingId,
        realtimeKitAuthToken: authToken,
      });

      // Initialize AI agent if enabled
      if (session.aiAgentEnabled) {
        const aiAgentUrl = process.env.VITE_AI_AGENT_URL;
        if (aiAgentUrl) {
          try {
            await fetch(
              `${aiAgentUrl}/init?sessionId=${args.sessionId}`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  meetingId,
                  authToken,
                  userId: args.userId,
                  projectTitle: session.projectTitle,
                  sessionType: session.sessionType,
                }),
              }
            );

            console.log("AI agent initialized successfully");
          } catch (error) {
            console.error("Failed to initialize AI agent:", error);
            // Don't fail the whole operation if AI agent fails
          }
        } else {
          console.log("AI agent enabled but VITE_AI_AGENT_URL not configured");
        }
      }

      return {
        success: true,
        meetingId,
        authToken,
      };
    } catch (error: any) {
      console.error("Error initializing meeting:", error);
      return {
        success: false,
        error: error.message || "Unknown error",
      };
    }
  },
});
