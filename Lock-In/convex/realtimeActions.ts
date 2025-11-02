import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

// Initialize a Cloudflare Calls meeting for a Lock In Session
// Creates session and returns session details for WebRTC connection

type InitializeMeetingResult = {
  success: boolean;
  sessionId?: string;
  error?: string;
};

export const initializeMeeting = action({
  args: {
    sessionId: v.id("lockInSessions"),
    userId: v.id("users"),
  },
  returns: v.object({
    success: v.boolean(),
    sessionId: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<InitializeMeetingResult> => {
    // Get Cloudflare Realtime credentials from Convex environment
    // Using REALTIMEKIT_* naming for compatibility
    const realtimeAppId = process.env.REALTIMEKIT_APP_ID;
    const realtimeApiToken = process.env.REALTIMEKIT_API_TOKEN;

    if (!realtimeAppId || !realtimeApiToken) {
      return {
        success: false,
        error: "Cloudflare Realtime credentials not configured. Set REALTIMEKIT_APP_ID and REALTIMEKIT_API_TOKEN environment variables.",
      };
    }

    console.log("Using Cloudflare Realtime App ID:", realtimeAppId);
    console.log("API Token starts with:", realtimeApiToken.substring(0, 10) + "...");
    console.log("API Token length:", realtimeApiToken.length);

    try {
      // Fetch session details
      const session: any = await ctx.runQuery(api.lockInSessions.get, {
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

      // Create a meeting using the RealtimeKit v2 API
      const createMeetingUrl = `https://api.realtime.cloudflare.com/v2/meetings`;
      console.log("Creating Realtime meeting:", createMeetingUrl);

      // Use BasicAuth with OrgID (realtimeAppId) and API Key (realtimeApiToken)
      const basicAuthCredentials = btoa(`${realtimeAppId}:${realtimeApiToken}`);

      const createMeetingResponse = await fetch(createMeetingUrl, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${basicAuthCredentials}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: session.title || "Lock-In Session",
          record_on_start: false,
        }),
      });

      console.log("Create meeting response status:", createMeetingResponse.status);

      if (!createMeetingResponse.ok) {
        const errorText = await createMeetingResponse.text();
        console.error("Failed to create Realtime meeting:", errorText);
        return {
          success: false,
          error: `Failed to create meeting: ${createMeetingResponse.status} - ${errorText}`,
        };
      }

      const meetingData = (await createMeetingResponse.json()) as {
        success: boolean;
        data: {
          id: string;
          // other meeting fields
        };
      };
      const meetingId = meetingData.data.id;

      console.log("Created Realtime meeting:", meetingId);

      // Add participant to get auth token
      const addParticipantUrl = `https://api.realtime.cloudflare.com/v2/meetings/${meetingId}/participants`;
      console.log("Adding participant to meeting:", addParticipantUrl);

      const addParticipantResponse = await fetch(addParticipantUrl, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${basicAuthCredentials}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: session.creator?.username || "Participant",
          preset_name: "group_call_host", // Default preset
          client_specific_id: args.userId,
        }),
      });

      console.log("Add participant response status:", addParticipantResponse.status);

      if (!addParticipantResponse.ok) {
        const errorText = await addParticipantResponse.text();
        console.error("Failed to add participant:", errorText);
        return {
          success: false,
          error: `Failed to add participant: ${addParticipantResponse.status} - ${errorText}`,
        };
      }

      const participantData = (await addParticipantResponse.json()) as {
        success: boolean;
        data: {
          id: string;
          token: string; // This is the authToken we need!
          // other participant fields
        };
      };
      const authToken = participantData.data.token;

      console.log("Participant added successfully, got authToken");

      // Store the meeting ID and auth token
      await ctx.runMutation(api.lockInSessions.start, {
        sessionId: args.sessionId,
        realtimeKitMeetingId: meetingId,
        realtimeKitAuthToken: authToken, // Now passing the actual auth token!
      });

      console.log("Cloudflare Realtime meeting initialized successfully");

      return {
        success: true,
        sessionId: meetingId,
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
