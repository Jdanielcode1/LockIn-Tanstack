import { v } from "convex/values";
import { action } from "./_generated/server";

// Generate an ephemeral token for OpenAI Realtime API
// This token is valid for 60 seconds and allows WebRTC connection
export const generateEphemeralToken = action({
  args: {
    sessionId: v.id("lockInSessions"),
  },
  returns: v.object({
    success: v.boolean(),
    token: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const openaiApiKey = process.env.OPENAI_API_KEY!;

    if (!openaiApiKey) {
      return {
        success: false,
        error: "OpenAI API key not configured",
      };
    }

    try {
      // Call OpenAI API to create an ephemeral session token
      const response = await fetch(
        "https://api.openai.com/v1/realtime/client_secrets",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            session: {
              type: "realtime",
              model: "gpt-realtime",
              audio: {
                output: {
                  voice: "marin",
                },
              },
              instructions: "You are a helpful AI coding assistant in a Lock-In work session. Users are working on programming projects and may ask you questions about their code, debugging help, or general programming advice. Be concise and helpful. Listen for users to say 'hey agent' followed by their question.",
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to create OpenAI session:", errorText);
        return {
          success: false,
          error: `Failed to create session: ${response.status}`,
        };
      }

      const data = await response.json();
      console.log("OpenAI API response:", JSON.stringify(data, null, 2));

      // The response structure should have either 'client_secret' or 'value' at the top level
      const token = data.client_secret?.value || data.value;

      if (!token) {
        console.error("Unexpected response structure:", data);
        return {
          success: false,
          error: "Invalid response structure from OpenAI API",
        };
      }

      console.log("Generated OpenAI ephemeral token for session:", args.sessionId);

      return {
        success: true,
        token: token,
      };
    } catch (error: any) {
      console.error("Error generating OpenAI ephemeral token:", error);
      return {
        success: false,
        error: error.message || "Unknown error",
      };
    }
  },
});
