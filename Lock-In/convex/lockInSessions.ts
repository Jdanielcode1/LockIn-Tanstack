import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { getAuthUserId } from "./authHelpers";

export const create = mutation({
  args: {
    projectId: v.optional(v.id("projects")),
    title: v.string(),
    description: v.string(),
    scheduledStartTime: v.number(),
    maxParticipants: v.number(),
    aiAgentEnabled: v.boolean(),
    sessionType: v.union(
      v.literal("coding"),
      v.literal("study"),
      v.literal("general")
    ),
  },
  returns: v.object({
    sessionId: v.id("lockInSessions"),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const sessionId = await ctx.db.insert("lockInSessions", {
      creatorId: userId,
      projectId: args.projectId,
      title: args.title,
      description: args.description,
      status: "scheduled",
      scheduledStartTime: args.scheduledStartTime,
      maxParticipants: args.maxParticipants,
      aiAgentEnabled: args.aiAgentEnabled,
      sessionType: args.sessionType,
      createdAt: Date.now(),
    });

    // Creator is automatically a participant and moderator
    await ctx.db.insert("sessionParticipants", {
      sessionId,
      userId: userId,
      joinedAt: Date.now(),
      isActive: false, // Not active until they actually join the meeting
      isModerator: true,
    });

    return { sessionId };
  },
});

export const start = mutation({
  args: {
    sessionId: v.id("lockInSessions"),
    realtimeKitMeetingId: v.string(),
    realtimeKitAuthToken: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;

    await ctx.db.patch(args.sessionId, {
      status: "active",
      actualStartTime: Date.now(),
      realtimeKitMeetingId: args.realtimeKitMeetingId,
      realtimeKitAuthToken: args.realtimeKitAuthToken,
    });

    return null;
  },
});

export const join = mutation({
  args: {
    sessionId: v.id("lockInSessions"),
  },
  returns: v.object({
    success: v.boolean(),
    meetingId: v.optional(v.string()),
    authToken: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session) {
      return { success: false, error: "Session not found" };
    }

    if (session.status === "ended") {
      return { success: false, error: "Session has ended" };
    }

    // Check if user is already a participant
    const existingParticipant = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session_and_user", (q) =>
        q.eq("sessionId", args.sessionId).eq("userId", userId)
      )
      .first();

    if (!existingParticipant) {
      // Check participant limit
      const activeParticipants = await ctx.db
        .query("sessionParticipants")
        .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

      if (activeParticipants.length >= session.maxParticipants) {
        return { success: false, error: "Session is full" };
      }

      // Add as new participant
      await ctx.db.insert("sessionParticipants", {
        sessionId: args.sessionId,
        userId: userId,
        joinedAt: Date.now(),
        isActive: true,
        isModerator: false,
      });
    } else {
      // Mark existing participant as active
      await ctx.db.patch(existingParticipant._id, {
        isActive: true,
        joinedAt: Date.now(),
      });
    }

    return {
      success: true,
      meetingId: session.realtimeKitMeetingId,
      authToken: session.realtimeKitAuthToken,
    };
  },
});

export const leave = mutation({
  args: {
    sessionId: v.id("lockInSessions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const participant = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session_and_user", (q) =>
        q.eq("sessionId", args.sessionId).eq("userId", userId)
      )
      .first();

    if (participant) {
      await ctx.db.patch(participant._id, {
        isActive: false,
        leftAt: Date.now(),
      });
    }

    return null;
  },
});

export const end = mutation({
  args: {
    sessionId: v.id("lockInSessions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;

    await ctx.db.patch(args.sessionId, {
      status: "ended",
      endTime: Date.now(),
      aiAgentActive: false,
    });

    // Mark all participants as inactive
    const participants = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    for (const participant of participants) {
      if (participant.isActive) {
        await ctx.db.patch(participant._id, {
          isActive: false,
          leftAt: Date.now(),
        });
      }
    }

    return null;
  },
});

export const get = query({
  args: {
    sessionId: v.id("lockInSessions"),
  },
  returns: v.union(
    v.object({
      _id: v.id("lockInSessions"),
      _creationTime: v.number(),
      creatorId: v.id("users"),
      projectId: v.optional(v.id("projects")),
      title: v.string(),
      description: v.string(),
      status: v.union(
        v.literal("scheduled"),
        v.literal("active"),
        v.literal("ended")
      ),
      scheduledStartTime: v.number(),
      actualStartTime: v.optional(v.number()),
      endTime: v.optional(v.number()),
      maxParticipants: v.number(),
      realtimeKitMeetingId: v.optional(v.string()),
      realtimeKitAuthToken: v.optional(v.string()),
      aiAgentEnabled: v.boolean(),
      aiAgentActive: v.optional(v.boolean()),
      sessionType: v.union(
        v.literal("coding"),
        v.literal("study"),
        v.literal("general")
      ),
      createdAt: v.number(),
      creator: v.object({
        username: v.optional(v.string()),
        displayName: v.optional(v.string()),
        avatarKey: v.optional(v.string()),
      }),
      projectTitle: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return null;

    const creator = await ctx.db.get(session.creatorId);
    if (!creator) return null;

    let projectTitle: string | undefined;
    if (session.projectId) {
      const project = await ctx.db.get(session.projectId);
      projectTitle = project?.title;
    }

    return {
      ...session,
      creator: {
        username: creator.username,
        displayName: creator.displayName,
        avatarKey: creator.avatarKey,
      },
      projectTitle,
    };
  },
});

export const listActive = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("lockInSessions"),
      _creationTime: v.number(),
      creatorId: v.id("users"),
      projectId: v.optional(v.id("projects")),
      title: v.string(),
      description: v.string(),
      status: v.union(
        v.literal("scheduled"),
        v.literal("active"),
        v.literal("ended")
      ),
      scheduledStartTime: v.number(),
      actualStartTime: v.optional(v.number()),
      endTime: v.optional(v.number()),
      maxParticipants: v.number(),
      aiAgentEnabled: v.boolean(),
      sessionType: v.union(
        v.literal("coding"),
        v.literal("study"),
        v.literal("general")
      ),
      createdAt: v.number(),
      creator: v.object({
        username: v.optional(v.string()),
        displayName: v.optional(v.string()),
        avatarKey: v.optional(v.string()),
      }),
      participantCount: v.number(),
    })
  ),
  handler: async (ctx) => {
    const sessions = await ctx.db
      .query("lockInSessions")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const enrichedSessions = [];
    for (const session of sessions) {
      const creator = await ctx.db.get(session.creatorId);
      if (!creator) continue;

      const participants = await ctx.db
        .query("sessionParticipants")
        .withIndex("by_session", (q) => q.eq("sessionId", session._id))
        .filter((q) => q.eq(q.field("isActive"), true))
        .collect();

      enrichedSessions.push({
        ...session,
        creator: {
          username: creator.username,
          displayName: creator.displayName,
          avatarKey: creator.avatarKey,
        },
        participantCount: participants.length,
      });
    }

    return enrichedSessions;
  },
});

export const listUpcoming = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("lockInSessions"),
      _creationTime: v.number(),
      creatorId: v.id("users"),
      projectId: v.optional(v.id("projects")),
      title: v.string(),
      description: v.string(),
      status: v.union(
        v.literal("scheduled"),
        v.literal("active"),
        v.literal("ended")
      ),
      scheduledStartTime: v.number(),
      maxParticipants: v.number(),
      aiAgentEnabled: v.boolean(),
      sessionType: v.union(
        v.literal("coding"),
        v.literal("study"),
        v.literal("general")
      ),
      createdAt: v.number(),
      creator: v.object({
        username: v.optional(v.string()),
        displayName: v.optional(v.string()),
        avatarKey: v.optional(v.string()),
      }),
    })
  ),
  handler: async (ctx) => {
    const now = Date.now();
    const sessions = await ctx.db
      .query("lockInSessions")
      .withIndex("by_status", (q) => q.eq("status", "scheduled"))
      .filter((q) => q.gte(q.field("scheduledStartTime"), now))
      .order("asc")
      .collect();

    const enrichedSessions = [];
    for (const session of sessions) {
      const creator = await ctx.db.get(session.creatorId);
      if (!creator) continue;

      enrichedSessions.push({
        ...session,
        creator: {
          username: creator.username,
          displayName: creator.displayName,
          avatarKey: creator.avatarKey,
        },
      });
    }

    return enrichedSessions;
  },
});

export const getParticipants = query({
  args: {
    sessionId: v.id("lockInSessions"),
  },
  returns: v.array(
    v.object({
      _id: v.id("sessionParticipants"),
      _creationTime: v.number(),
      sessionId: v.id("lockInSessions"),
      userId: v.id("users"),
      joinedAt: v.number(),
      leftAt: v.optional(v.number()),
      isActive: v.boolean(),
      isModerator: v.boolean(),
      user: v.object({
        username: v.optional(v.string()),
        displayName: v.optional(v.string()),
        avatarKey: v.optional(v.string()),
      }),
    })
  ),
  handler: async (ctx, args) => {
    const participants = await ctx.db
      .query("sessionParticipants")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const enrichedParticipants = [];
    for (const participant of participants) {
      const user = await ctx.db.get(participant.userId);
      if (!user) continue;

      enrichedParticipants.push({
        ...participant,
        user: {
          username: user.username,
          displayName: user.displayName,
          avatarKey: user.avatarKey,
        },
      });
    }

    return enrichedParticipants;
  },
});

export const toggleAIAgent = mutation({
  args: {
    sessionId: v.id("lockInSessions"),
    active: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session || !session.aiAgentEnabled) return null;

    await ctx.db.patch(args.sessionId, {
      aiAgentActive: args.active,
    });

    return null;
  },
});
