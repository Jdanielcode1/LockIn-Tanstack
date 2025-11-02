import { LockInAgent, Env } from "./LockInAgent";

export { LockInAgent };

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers for frontend
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Extract session ID from query params or path
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: "sessionId is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Get or create Durable Object for this session
    const agentId = sessionId;
    const id = env.LOCKIN_AGENT.idFromName(sessionId);
    const stub = env.LOCKIN_AGENT.get(id);

    // Forward internal pipeline requests directly to the Durable Object
    if (url.pathname.startsWith("/agentsInternal")) {
      return stub.fetch(request);
    }

    // Handle agent lifecycle endpoints
    switch (url.pathname) {
      case "/init":
        try {
          // Parse request body for session context
          const body = await request.json() as {
            meetingId: string;
            authToken: string;
            userId: string;
            projectTitle?: string;
            sessionType: "coding" | "study" | "general";
          };

          if (!body.meetingId || !body.authToken || !body.userId) {
            return new Response(
              JSON.stringify({
                error: "meetingId, authToken, and userId are required",
              }),
              {
                status: 400,
                headers: { "Content-Type": "application/json", ...corsHeaders },
              }
            );
          }

          console.log(`[Worker] Initializing agent for session: ${sessionId}`);

          // Initialize the agent with session context
          await stub.init(
            agentId,
            body.meetingId,
            body.authToken,
            url.host,
            env.ACCOUNT_ID,
            env.API_TOKEN,
            sessionId,
            body.userId,
            {
              projectTitle: body.projectTitle,
              sessionType: body.sessionType,
            }
          );

          return new Response(
            JSON.stringify({ success: true, message: "Agent initialized" }),
            {
              status: 200,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            }
          );
        } catch (error: any) {
          console.error("[Worker] Init error:", error);
          return new Response(
            JSON.stringify({ error: error.message }),
            {
              status: 500,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            }
          );
        }

      case "/deinit":
        try {
          console.log(`[Worker] Deinitializing agent for session: ${sessionId}`);
          await stub.deinit();

          return new Response(
            JSON.stringify({ success: true, message: "Agent deinitialized" }),
            {
              status: 200,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            }
          );
        } catch (error: any) {
          console.error("[Worker] Deinit error:", error);
          return new Response(
            JSON.stringify({ error: error.message }),
            {
              status: 500,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            }
          );
        }

      case "/health":
        return new Response(
          JSON.stringify({
            status: "healthy",
            service: "Lock In AI Agent",
            timestamp: Date.now(),
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );

      default:
        return new Response(
          JSON.stringify({ error: "Not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
    }
  },
};
