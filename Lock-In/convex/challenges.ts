import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

export const create = mutation({
  args: {
    creatorId: v.id("users"),
    clubId: v.optional(v.id("clubs")), // Optional: link challenge to a club
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
    // If clubId is provided, verify creator is a member of the club
    if (args.clubId) {
      const membership = await ctx.db
        .query("clubMembers")
        .withIndex("by_club_and_user", (q) =>
          q.eq("clubId", args.clubId!).eq("userId", args.creatorId)
        )
        .first();

      if (!membership) {
        throw new Error("Only club members can create club challenges");
      }
    }

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

    // Get club info if challenge is linked to a club
    let club = null;
    if (challenge.clubId) {
      const clubData = await ctx.db.get(challenge.clubId);
      if (clubData) {
        club = {
          _id: clubData._id,
          name: clubData.name,
          type: clubData.type,
        };
      }
    }

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
      club,
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

// Get active challenges for a user
export const getUserChallenges = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.array(
    v.object({
      _id: v.id("challenges"),
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
      participantCount: v.number(),
      isActive: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    // Get all challenge participations for this user
    const participations = await ctx.db
      .query("challengeParticipants")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Get full challenge details
    const challenges = await Promise.all(
      participations.map(async (p) => {
        const challenge = await ctx.db.get(p.challengeId);
        if (!challenge) return null;

        // Get participant count
        const participants = await ctx.db
          .query("challengeParticipants")
          .withIndex("by_challenge", (q) => q.eq("challengeId", p.challengeId))
          .collect();

        // Check if challenge is currently active
        const now = Date.now();
        const isActive = now >= challenge.startDate && now <= challenge.endDate;

        return {
          _id: challenge._id,
          title: challenge.title,
          description: challenge.description,
          type: challenge.type,
          goal: challenge.goal,
          startDate: challenge.startDate,
          endDate: challenge.endDate,
          participantCount: participants.length,
          isActive,
        };
      })
    );

    // Filter out nulls and return
    return challenges.filter((c) => c !== null) as any;
  },
});

// Get challenge leaderboard with participant rankings
export const getChallengeLeaderboard = query({
  args: {
    challengeId: v.id("challenges"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) return null;

    // Get all participants
    const participants = await ctx.db
      .query("challengeParticipants")
      .withIndex("by_challenge", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    // For each participant, calculate their hours during the challenge period
    const leaderboard = await Promise.all(
      participants.map(async (participant) => {
        const user = await ctx.db.get(participant.userId);
        if (!user) return null;

        // Get timelapses uploaded during challenge period
        const timelapses = await ctx.db
          .query("timelapses")
          .withIndex("by_user", (q) => q.eq("userId", participant.userId))
          .collect();

        // Filter timelapses within challenge date range
        const challengeTimelapses = timelapses.filter(
          (t) =>
            t.uploadedAt >= challenge.startDate &&
            t.uploadedAt <= challenge.endDate
        );

        // Calculate total hours
        const totalHours = challengeTimelapses.reduce(
          (sum, t) => sum + t.durationMinutes / 60,
          0
        );

        // Count timelapses tagged with this challenge
        const taggedTimelapses = challengeTimelapses.filter(
          (t) => t.challengeId === args.challengeId
        );

        return {
          userId: participant.userId,
          username: user.username,
          displayName: user.displayName,
          avatarKey: user.avatarKey,
          totalHours: Math.round(totalHours * 10) / 10,
          timelapsesCount: challengeTimelapses.length,
          taggedTimelapsesCount: taggedTimelapses.length,
          joinedAt: participant.joinedAt,
        };
      })
    );

    // Filter out nulls and sort by hours descending
    const sorted = leaderboard
      .filter((p) => p !== null)
      .sort((a, b) => b!.totalHours - a!.totalHours);

    return sorted;
  },
});

// Get challenge activity feed (recent timelapses from participants)
export const getChallengeActivity = query({
  args: {
    challengeId: v.id("challenges"),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) return [];

    const limit = args.limit || 20;

    // Get all participants
    const participants = await ctx.db
      .query("challengeParticipants")
      .withIndex("by_challenge", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    const participantIds = participants.map((p) => p.userId);

    // Get timelapses from participants during challenge period
    const allTimelapses = await ctx.db
      .query("timelapses")
      .withIndex("by_uploaded", (q) => q.gte("uploadedAt", challenge.startDate))
      .collect();

    // Filter to only participants and within date range
    const challengeTimelapses = allTimelapses.filter(
      (t) =>
        participantIds.includes(t.userId) &&
        t.uploadedAt >= challenge.startDate &&
        t.uploadedAt <= challenge.endDate
    );

    // Sort by upload date descending and limit
    const sorted = challengeTimelapses
      .sort((a, b) => b.uploadedAt - a.uploadedAt)
      .slice(0, limit);

    // Enrich with user and project info
    const enriched = await Promise.all(
      sorted.map(async (timelapse) => {
        const user = await ctx.db.get(timelapse.userId);
        const project = await ctx.db.get(timelapse.projectId);

        return {
          ...timelapse,
          user: user
            ? {
                username: user.username,
                displayName: user.displayName,
                avatarKey: user.avatarKey,
              }
            : null,
          project: project
            ? {
                title: project.title,
              }
            : null,
          isTagged: timelapse.challengeId === args.challengeId,
        };
      })
    );

    return enriched;
  },
});

// Get challenge stats
export const getChallengeStats = query({
  args: {
    challengeId: v.id("challenges"),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId);
    if (!challenge) return null;

    // Get all participants
    const participants = await ctx.db
      .query("challengeParticipants")
      .withIndex("by_challenge", (q) => q.eq("challengeId", args.challengeId))
      .collect();

    // Get all timelapses during challenge period from participants
    const participantIds = participants.map((p) => p.userId);
    const allTimelapses = await ctx.db
      .query("timelapses")
      .withIndex("by_uploaded", (q) => q.gte("uploadedAt", challenge.startDate))
      .collect();

    const challengeTimelapses = allTimelapses.filter(
      (t) =>
        participantIds.includes(t.userId) &&
        t.uploadedAt >= challenge.startDate &&
        t.uploadedAt <= challenge.endDate
    );

    // Calculate stats
    const totalHours = challengeTimelapses.reduce(
      (sum, t) => sum + t.durationMinutes / 60,
      0
    );
    const totalTimelapses = challengeTimelapses.length;
    const taggedTimelapses = challengeTimelapses.filter(
      (t) => t.challengeId === args.challengeId
    ).length;

    // Calculate average hours per participant
    const avgHoursPerParticipant =
      participants.length > 0 ? totalHours / participants.length : 0;

    const now = Date.now();
    const isActive = now >= challenge.startDate && now <= challenge.endDate;
    const daysRemaining = isActive
      ? Math.ceil((challenge.endDate - now) / (1000 * 60 * 60 * 24))
      : 0;

    return {
      totalParticipants: participants.length,
      totalHours: Math.round(totalHours * 10) / 10,
      totalTimelapses,
      taggedTimelapses,
      avgHoursPerParticipant: Math.round(avgHoursPerParticipant * 10) / 10,
      isActive,
      daysRemaining,
    };
  },
});
