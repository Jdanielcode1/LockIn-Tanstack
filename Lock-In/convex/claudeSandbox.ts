/**
 * Claude Code Sandbox Management
 *
 * Convex actions and mutations for managing Claude Code sandboxes in Lock-In sessions.
 * Integrates with the Cloudflare Worker Durable Object for sandbox execution.
 */

import { v } from "convex/values";
import { action, mutation, query, internalMutation } from "./_generated/server";
import { api } from "./_generated/api";
import { internal } from "./_generated/api";
import { authComponent } from "./auth";

// Get Cloudflare Worker URL from environment
// Set via: npx convex env set CLAUDE_SANDBOX_WORKER_URL "https://your-worker.workers.dev"
const getSandboxWorkerUrl = () => {
  return process.env.CLAUDE_SANDBOX_WORKER_URL || "http://localhost:8787";
};

// Helper to get authenticated user ID in actions
async function getAuthUserIdInAction(ctx: any): Promise<any> {
  const betterAuthUser = await authComponent.getAuthUser(ctx);
  if (!betterAuthUser) {
    throw new Error("Not authenticated");
  }

  // Look up Lock-In user by email
  const user: any = await ctx.runQuery(api.users.getByEmail, {
    email: betterAuthUser.email,
  });

  if (!user) {
    throw new Error("User not found in Lock-In database");
  }

  return user._id;
}

/**
 * Initialize Claude Code sandbox for a session
 */
export const initializeSandbox = action({
  args: {
    sessionId: v.id("lockInSessions"),
    repository: v.optional(v.string()),
    task: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    sandboxId: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserIdInAction(ctx);

    // Get session to verify user is creator or moderator
    const session: any = await ctx.runQuery(api.lockInSessions.get, {
      sessionId: args.sessionId,
    });

    if (!session) {
      return { success: false, error: "Session not found" };
    }

    // Check if user is creator or moderator
    const participant: any = await ctx.runQuery(api.lockInSessions.getParticipant, {
      sessionId: args.sessionId,
      userId,
    });

    if (session.creatorId !== userId && (!participant || !participant.isModerator)) {
      return { success: false, error: "Only session creator or moderators can initialize Claude sandbox" };
    }

    try {
      const workerUrl = getSandboxWorkerUrl();
      const response = await fetch(`${workerUrl}/sandbox/${args.sessionId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          repository: args.repository,
          task: args.task,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Failed to initialize sandbox: ${error}` };
      }

      const result = await response.json() as any;

      // Update session with sandbox info
      await ctx.runMutation(internal.claudeSandbox.updateSessionSandboxInternal, {
        sessionId: args.sessionId,
        claudeSandboxEnabled: true,
        claudeSandboxId: args.sessionId,
        claudeSandboxActive: true,
        claudeRepository: args.repository,
      });

      // Log initialization message
      await ctx.runMutation(internal.claudeSandbox.logMessageInternal, {
        sessionId: args.sessionId,
        userId,
        messageType: "status",
        content: `Claude sandbox initialized${args.repository ? ` with repository: ${args.repository}` : ""}`,
      });

      return {
        success: true,
        sandboxId: args.sessionId,
      };
    } catch (error) {
      console.error("Error initializing sandbox:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Send command to Claude sandbox
 */
export const sendCommand = action({
  args: {
    sessionId: v.id("lockInSessions"),
    command: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    output: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<any> => {
    const userId: any = await getAuthUserIdInAction(ctx);

    // Verify user is a participant
    const participant: any = await ctx.runQuery(api.lockInSessions.getParticipant, {
      sessionId: args.sessionId,
      userId,
    });

    if (!participant || !participant.isActive) {
      return { success: false, error: "You must be an active participant to send commands" };
    }

    try {
      // Log the command
      await ctx.runMutation(internal.claudeSandbox.logMessageInternal, {
        sessionId: args.sessionId,
        userId,
        messageType: "command" as const,
        content: args.command,
      });

      const workerUrl = getSandboxWorkerUrl();
      const response: any = await fetch(`${workerUrl}/sandbox/${args.sessionId}/command`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          command: args.command,
          userId,
        }),
      });

      if (!response.ok) {
        const error: any = await response.text();
        await ctx.runMutation(internal.claudeSandbox.logMessageInternal, {
          sessionId: args.sessionId,
          userId,
          messageType: "error",
          content: `Command failed: ${error}`,
        });
        return { success: false, error: `Failed to execute command: ${error}` };
      }

      const result = await response.json() as any;

      // Log the output (WebSocket will also send it, but store in DB for history)
      if (result.output) {
        await ctx.runMutation(internal.claudeSandbox.logMessageInternal, {
          sessionId: args.sessionId,
          userId,
          messageType: "output",
          content: result.output,
        });
      }

      return {
        success: true,
        output: result.output,
      };
    } catch (error) {
      console.error("Error sending command:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      await ctx.runMutation(internal.claudeSandbox.logMessageInternal, {
        sessionId: args.sessionId,
        userId,
        messageType: "error",
        content: errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});

/**
 * Get sandbox status
 */
export const getSandboxStatus = action({
  args: {
    sessionId: v.id("lockInSessions"),
  },
  returns: v.object({
    isActive: v.boolean(),
    repository: v.optional(v.string()),
    connections: v.number(),
    commandCount: v.number(),
  }),
  handler: async (ctx, args) => {
    try {
      const workerUrl = getSandboxWorkerUrl();
      const response = await fetch(`${workerUrl}/sandbox/${args.sessionId}/status`);

      if (!response.ok) {
        throw new Error(`Failed to get sandbox status: ${await response.text()}`);
      }

      return await response.json() as any;
    } catch (error) {
      console.error("Error getting sandbox status:", error);
      return {
        isActive: false,
        connections: 0,
        commandCount: 0,
      };
    }
  },
});

/**
 * Destroy sandbox (called when session ends)
 */
export const destroySandbox = action({
  args: {
    sessionId: v.id("lockInSessions"),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserIdInAction(ctx);

    // Get session to verify user is creator
    const session: any = await ctx.runQuery(api.lockInSessions.get, {
      sessionId: args.sessionId,
    });

    if (!session) {
      return { success: false, error: "Session not found" };
    }

    if (session.creatorId !== userId) {
      return { success: false, error: "Only session creator can destroy sandbox" };
    }

    try {
      const workerUrl = getSandboxWorkerUrl();
      const response = await fetch(`${workerUrl}/sandbox/${args.sessionId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Failed to destroy sandbox: ${error}` };
      }

      // Update session
      await ctx.runMutation(internal.claudeSandbox.updateSessionSandboxInternal, {
        sessionId: args.sessionId,
        claudeSandboxActive: false,
      });

      // Log destruction
      await ctx.runMutation(internal.claudeSandbox.logMessageInternal, {
        sessionId: args.sessionId,
        userId,
        messageType: "status",
        content: "Claude sandbox destroyed",
      });

      return { success: true };
    } catch (error) {
      console.error("Error destroying sandbox:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Get message history for a session
 */
export const getMessages = query({
  args: {
    sessionId: v.id("lockInSessions"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;

    const messages = await ctx.db
      .query("claudeMessages")
      .withIndex("by_session_and_timestamp", (q) =>
        q.eq("sessionId", args.sessionId)
      )
      .order("desc")
      .take(limit);

    // Reverse to get chronological order
    return messages.reverse();
  },
});

/**
 * Internal mutation to update session sandbox fields
 */
export const updateSessionSandboxInternal = internalMutation({
  args: {
    sessionId: v.id("lockInSessions"),
    claudeSandboxEnabled: v.optional(v.boolean()),
    claudeSandboxId: v.optional(v.string()),
    claudeSandboxActive: v.optional(v.boolean()),
    claudeRepository: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const updates: any = {};

    if (args.claudeSandboxEnabled !== undefined) {
      updates.claudeSandboxEnabled = args.claudeSandboxEnabled;
    }
    if (args.claudeSandboxId !== undefined) {
      updates.claudeSandboxId = args.claudeSandboxId;
    }
    if (args.claudeSandboxActive !== undefined) {
      updates.claudeSandboxActive = args.claudeSandboxActive;
    }
    if (args.claudeRepository !== undefined) {
      updates.claudeRepository = args.claudeRepository;
    }

    await ctx.db.patch(args.sessionId, updates);
  },
});

/**
 * Internal mutation to log a message
 */
export const logMessageInternal = internalMutation({
  args: {
    sessionId: v.id("lockInSessions"),
    userId: v.id("users"),
    messageType: v.union(
      v.literal("command"),
      v.literal("output"),
      v.literal("error"),
      v.literal("status")
    ),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("claudeMessages", {
      sessionId: args.sessionId,
      userId: args.userId,
      messageType: args.messageType,
      content: args.content,
      timestamp: Date.now(),
    });
  },
});
