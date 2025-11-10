import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getAuthUserId } from "./authHelpers";

export const logInteraction = mutation({
  args: {
    sessionId: v.id("lockInSessions"),
    question: v.string(),
    response: v.string(),
  },
  returns: v.object({
    logId: v.id("aiAssistanceLogs"),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const logId = await ctx.db.insert("aiAssistanceLogs", {
      sessionId: args.sessionId,
      userId: userId,
      question: args.question,
      response: args.response,
      timestamp: Date.now(),
    });

    return { logId };
  },
});

// Internal mutation for Worker to call via HTTP action
export const logInteractionInternal = internalMutation({
  args: {
    sessionId: v.id("lockInSessions"),
    userId: v.id("users"),
    question: v.string(),
    response: v.string(),
  },
  returns: v.object({
    logId: v.id("aiAssistanceLogs"),
  }),
  handler: async (ctx, args) => {
    const logId = await ctx.db.insert("aiAssistanceLogs", {
      sessionId: args.sessionId,
      userId: args.userId,
      question: args.question,
      response: args.response,
      timestamp: Date.now(),
    });

    return { logId };
  },
});

export const getSessionLogs = query({
  args: {
    sessionId: v.id("lockInSessions"),
  },
  returns: v.array(
    v.object({
      _id: v.id("aiAssistanceLogs"),
      _creationTime: v.number(),
      sessionId: v.id("lockInSessions"),
      userId: v.id("users"),
      question: v.string(),
      response: v.string(),
      timestamp: v.number(),
      helpful: v.optional(v.boolean()),
      user: v.object({
        username: v.optional(v.string()),
        displayName: v.optional(v.string()),
        avatarKey: v.optional(v.string()),
      }),
    })
  ),
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("aiAssistanceLogs")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .collect();

    const enrichedLogs = [];
    for (const log of logs) {
      const user = await ctx.db.get(log.userId);
      if (!user) continue;

      enrichedLogs.push({
        ...log,
        user: {
          username: user.username,
          displayName: user.displayName,
          avatarKey: user.avatarKey,
        },
      });
    }

    return enrichedLogs;
  },
});

export const getUserLogs = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.array(
    v.object({
      _id: v.id("aiAssistanceLogs"),
      _creationTime: v.number(),
      sessionId: v.id("lockInSessions"),
      userId: v.id("users"),
      question: v.string(),
      response: v.string(),
      timestamp: v.number(),
      helpful: v.optional(v.boolean()),
      sessionTitle: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("aiAssistanceLogs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    const enrichedLogs = [];
    for (const log of logs) {
      const session = await ctx.db.get(log.sessionId);
      if (!session) continue;

      enrichedLogs.push({
        ...log,
        sessionTitle: session.title,
      });
    }

    return enrichedLogs;
  },
});

export const markHelpful = mutation({
  args: {
    logId: v.id("aiAssistanceLogs"),
    helpful: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const log = await ctx.db.get(args.logId);
    if (!log) return null;

    await ctx.db.patch(args.logId, {
      helpful: args.helpful,
    });

    return null;
  },
});
