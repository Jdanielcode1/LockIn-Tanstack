import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

export const create = mutation({
  args: {
    creatorId: v.id("users"),
    title: v.string(),
    description: v.string(),
    type: v.union(
      v.literal("reading"),
      v.literal("study"),
      v.literal("workout"),
      v.literal("custom")
    ),
    goal: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.number(),
  },
  returns: v.object({
    challengeId: v.id("challenges"),
  }),
  handler: async (ctx, args) => {
    const challengeId = await ctx.db.insert("challenges", {
      ...args,
      createdAt: Date.now(),
    });

    // Auto-join creator to the challenge
    await ctx.db.insert("challengeParticipants", {
      challengeId,
      userId: args.creatorId,
      joinedAt: Date.now(),
    });

    return { challengeId };
  },
});

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("challenges")
      .order("desc")
      .paginate(args.paginationOpts);

    // Enrich with participant count and creator info
    const enrichedPage = await Promise.all(
      result.page.map(async (challenge) => {
        const participants = await ctx.db
          .query("challengeParticipants")
          .withIndex("by_challenge", (q) =>
            q.eq("challengeId", challenge._id)
          )
          .collect();

        const creator = await ctx.db.get(challenge.creatorId);

        return {
          ...challenge,
          participantCount: participants.length,
          creator: creator
            ? {
                username: creator.username,
                displayName: creator.displayName,
                avatarKey: creator.avatarKey,
              }
            : null,
        };
      })
    );

    return {
      ...result,
      page: enrichedPage,
    };
  },
});

export const get = query({
  args: {
    challengeId: v.id("challenges"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) return null;

    const participants = await ctx.db
      .query("challengeParticipants")
      .withIndex("by_challenge", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    const creator = await ctx.db.get(challenge.creatorId);

    return {
      ...challenge,
      participantCount: participants.length,
      creator: creator
        ? {
            username: creator.username,
            displayName: creator.displayName,
            avatarKey: creator.avatarKey,
          }
        : null,
    };
  },
});

export const join = mutation({
  args: {
    challengeId: v.id("challenges"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Check if already joined
    const existing = await ctx.db
      .query("challengeParticipants")
      .withIndex("by_challenge_and_user", (q) =>
        q.eq("challengeId", args.challengeId).eq("userId", args.userId)
      )
      .first();

    if (existing) {
      throw new Error("Already joined this challenge");
    }

    await ctx.db.insert("challengeParticipants", {
      challengeId: args.challengeId,
      userId: args.userId,
      joinedAt: Date.now(),
    });

    return null;
  },
});

export const leave = mutation({
  args: {
    challengeId: v.id("challenges"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const participant = await ctx.db
      .query("challengeParticipants")
      .withIndex("by_challenge_and_user", (q) =>
        q.eq("challengeId", args.challengeId).eq("userId", args.userId)
      )
      .first();

    if (participant) {
      await ctx.db.delete(participant._id);
    }

    return null;
  },
});

export const isParticipating = query({
  args: {
    challengeId: v.id("challenges"),
    userId: v.id("users"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const participant = await ctx.db
      .query("challengeParticipants")
      .withIndex("by_challenge_and_user", (q) =>
        q.eq("challengeId", args.challengeId).eq("userId", args.userId)
      )
      .first();

    return participant !== null;
  },
});
