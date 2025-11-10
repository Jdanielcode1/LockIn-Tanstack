import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "./authHelpers";

// List public clubs
export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("clubs"),
      name: v.string(),
      description: v.string(),
      type: v.union(
        v.literal("coding"),
        v.literal("study"),
        v.literal("fitness"),
        v.literal("general")
      ),
      memberCount: v.number(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit || 5;

    const clubs = await ctx.db
      .query("clubs")
      .withIndex("by_public", (q) => q.eq("isPublic", true))
      .order("desc")
      .take(limit);

    return clubs.map((club) => ({
      _id: club._id,
      name: club.name,
      description: club.description,
      type: club.type,
      memberCount: club.memberCount,
      createdAt: club.createdAt,
    }));
  },
});

// Get a single club with details
export const get = query({
  args: {
    clubId: v.id("clubs"),
  },
  returns: v.union(
    v.object({
      _id: v.id("clubs"),
      name: v.string(),
      description: v.string(),
      type: v.union(
        v.literal("coding"),
        v.literal("study"),
        v.literal("fitness"),
        v.literal("general")
      ),
      memberCount: v.number(),
      isPublic: v.boolean(),
      createdAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const club = await ctx.db.get(args.clubId);
    if (!club) return null;

    return {
      _id: club._id,
      name: club.name,
      description: club.description,
      type: club.type,
      memberCount: club.memberCount,
      isPublic: club.isPublic,
      createdAt: club.createdAt,
    };
  },
});

// Get club members
export const getMembers = query({
  args: {
    clubId: v.id("clubs"),
  },
  returns: v.array(
    v.object({
      _id: v.id("users"),
      displayName: v.optional(v.string()),
      avatarKey: v.optional(v.string()),
      bio: v.optional(v.string()),
      location: v.optional(v.string()),
      role: v.union(v.literal("admin"), v.literal("member")),
      joinedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("clubMembers")
      .withIndex("by_club", (q) => q.eq("clubId", args.clubId))
      .collect();

    const members = await Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db.get(membership.userId);
        if (!user) return null;

        return {
          _id: user._id,
          displayName: user.displayName,
          avatarKey: user.avatarKey,
          bio: user.bio,
          location: user.location,
          role: membership.role,
          joinedAt: membership.joinedAt,
        };
      })
    );

    return members.filter((m) => m !== null);
  },
});

// Check if user is member of a club
export const isMember = query({
  args: {
    clubId: v.id("clubs"),
    userId: v.id("users"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("clubMembers")
      .withIndex("by_club_and_user", (q) =>
        q.eq("clubId", args.clubId).eq("userId", args.userId)
      )
      .first();

    return !!membership;
  },
});

// Join a club
export const join = mutation({
  args: {
    clubId: v.id("clubs"),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    // Check if already a member
    const existing = await ctx.db
      .query("clubMembers")
      .withIndex("by_club_and_user", (q) =>
        q.eq("clubId", args.clubId).eq("userId", userId)
      )
      .first();

    if (existing) {
      return { success: false };
    }

    // Add member
    await ctx.db.insert("clubMembers", {
      clubId: args.clubId,
      userId: userId,
      role: "member",
      joinedAt: Date.now(),
    });

    // Update member count
    const club = await ctx.db.get(args.clubId);
    if (club) {
      await ctx.db.patch(args.clubId, {
        memberCount: club.memberCount + 1,
      });
    }

    return { success: true };
  },
});

// Leave a club
export const leave = mutation({
  args: {
    clubId: v.id("clubs"),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const membership = await ctx.db
      .query("clubMembers")
      .withIndex("by_club_and_user", (q) =>
        q.eq("clubId", args.clubId).eq("userId", userId)
      )
      .first();

    if (!membership) {
      return { success: false };
    }

    // Don't allow creator/admin to leave (they must delete the club instead)
    if (membership.role === "admin") {
      return { success: false };
    }

    await ctx.db.delete(membership._id);

    // Update member count
    const club = await ctx.db.get(args.clubId);
    if (club) {
      await ctx.db.patch(args.clubId, {
        memberCount: Math.max(0, club.memberCount - 1),
      });
    }

    return { success: true };
  },
});

// Get club activity feed (timelapses from members)
export const getActivity = query({
  args: {
    clubId: v.id("clubs"),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const limit = args.limit || 20;

    // Get all club members
    const memberships = await ctx.db
      .query("clubMembers")
      .withIndex("by_club", (q) => q.eq("clubId", args.clubId))
      .collect();

    const memberIds = memberships.map((m) => m.userId);

    // Get timelapses from all members
    const allTimelapses = await ctx.db
      .query("timelapses")
      .withIndex("by_uploaded", (q) => q)
      .order("desc")
      .collect();

    // Filter timelapses by club members
    const clubTimelapses = allTimelapses
      .filter((t) => memberIds.includes(t.userId))
      .slice(0, limit);

    // Enrich with user and project data
    const enriched = await Promise.all(
      clubTimelapses.map(async (timelapse) => {
        const user = await ctx.db.get(timelapse.userId);
        const project = await ctx.db.get(timelapse.projectId);

        return {
          _id: timelapse._id,
          videoKey: timelapse.videoKey,
          thumbnailKey: timelapse.thumbnailKey,
          durationMinutes: timelapse.durationMinutes,
          uploadedAt: timelapse.uploadedAt,
          viewCount: timelapse.viewCount,
          likeCount: timelapse.likeCount,
          videoWidth: timelapse.videoWidth,
          videoHeight: timelapse.videoHeight,
          user: user
            ? {
                _id: user._id,
                displayName: user.displayName,
                avatarKey: user.avatarKey,
              }
            : null,
          project: project
            ? {
                _id: project._id,
                title: project.title,
              }
            : null,
        };
      })
    );

    return enriched;
  },
});

// Get club stats
export const getStats = query({
  args: {
    clubId: v.id("clubs"),
  },
  returns: v.object({
    totalMembers: v.number(),
    totalHours: v.number(),
    totalTimelapses: v.number(),
    activeThisWeek: v.number(),
  }),
  handler: async (ctx, args) => {
    // Get all club members
    const memberships = await ctx.db
      .query("clubMembers")
      .withIndex("by_club", (q) => q.eq("clubId", args.clubId))
      .collect();

    const memberIds = memberships.map((m) => m.userId);
    const totalMembers = memberIds.length;

    // Get all timelapses from members
    const allTimelapses = await ctx.db.query("timelapses").collect();
    const clubTimelapses = allTimelapses.filter((t) =>
      memberIds.includes(t.userId)
    );

    // Calculate total hours and timelapses
    const totalHours = clubTimelapses.reduce(
      (sum, t) => sum + t.durationMinutes / 60,
      0
    );
    const totalTimelapses = clubTimelapses.length;

    // Calculate active members this week
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentTimelapses = clubTimelapses.filter(
      (t) => t.uploadedAt >= weekAgo
    );
    const activeUserIds = new Set(recentTimelapses.map((t) => t.userId));
    const activeThisWeek = activeUserIds.size;

    return {
      totalMembers,
      totalHours: Math.round(totalHours * 10) / 10,
      totalTimelapses,
      activeThisWeek,
    };
  },
});

// Get club challenges
export const getChallenges = query({
  args: {
    clubId: v.id("clubs"),
    limit: v.optional(v.number()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    const challenges = await ctx.db
      .query("challenges")
      .withIndex("by_club", (q) => q.eq("clubId", args.clubId))
      .order("desc")
      .take(limit);

    // Enrich with participant count
    const enriched = await Promise.all(
      challenges.map(async (challenge) => {
        const participants = await ctx.db
          .query("challengeParticipants")
          .withIndex("by_challenge", (q) => q.eq("challengeId", challenge._id))
          .collect();

        return {
          _id: challenge._id,
          title: challenge.title,
          description: challenge.description,
          type: challenge.type,
          goal: challenge.goal,
          startDate: challenge.startDate,
          endDate: challenge.endDate,
          participantCount: participants.length,
          createdAt: challenge.createdAt,
        };
      })
    );

    return enriched;
  },
});

// Get club leaderboard (most active members)
export const getLeaderboard = query({
  args: {
    clubId: v.id("clubs"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("users"),
      displayName: v.optional(v.string()),
      avatarKey: v.optional(v.string()),
      totalHours: v.number(),
      timelapseCount: v.number(),
      rank: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    // Get all club members
    const memberships = await ctx.db
      .query("clubMembers")
      .withIndex("by_club", (q) => q.eq("clubId", args.clubId))
      .collect();

    const memberIds = memberships.map((m) => m.userId);

    // Get all timelapses from members
    const allTimelapses = await ctx.db.query("timelapses").collect();
    const clubTimelapses = allTimelapses.filter((t) =>
      memberIds.includes(t.userId)
    );

    // Calculate hours and timelapse count per member
    const memberStats = new Map<
      string,
      { totalHours: number; timelapseCount: number }
    >();

    for (const timelapse of clubTimelapses) {
      const userId = timelapse.userId;
      const existing = memberStats.get(userId) || {
        totalHours: 0,
        timelapseCount: 0,
      };
      memberStats.set(userId, {
        totalHours: existing.totalHours + timelapse.durationMinutes / 60,
        timelapseCount: existing.timelapseCount + 1,
      });
    }

    // Build leaderboard - only include members who have stats
    const leaderboard = await Promise.all(
      memberships.map(async (membership) => {
        const stats = memberStats.get(membership.userId);
        if (!stats) return null; // Skip members with no activity

        const user = await ctx.db.get(membership.userId);
        if (!user) return null;

        return {
          _id: user._id,
          displayName: user.displayName,
          avatarKey: user.avatarKey,
          totalHours: Math.round(stats.totalHours * 10) / 10,
          timelapseCount: stats.timelapseCount,
          rank: 0, // Will be set after sorting
        };
      })
    );

    // Filter nulls and sort by total hours
    const sorted = leaderboard
      .filter((m) => m !== null)
      .sort((a, b) => b!.totalHours - a!.totalHours)
      .slice(0, limit);

    // Assign ranks
    sorted.forEach((member, index) => {
      member!.rank = index + 1;
    });

    return sorted as any;
  },
});

// Create a new club
export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    type: v.union(
      v.literal("coding"),
      v.literal("study"),
      v.literal("fitness"),
      v.literal("general")
    ),
    isPublic: v.boolean(),
  },
  returns: v.object({
    clubId: v.id("clubs"),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const clubId = await ctx.db.insert("clubs", {
      name: args.name,
      description: args.description,
      type: args.type,
      creatorId: userId,
      memberCount: 1, // Creator is first member
      isPublic: args.isPublic,
      createdAt: Date.now(),
    });

    // Add creator as admin member
    await ctx.db.insert("clubMembers", {
      clubId,
      userId: userId,
      role: "admin",
      joinedAt: Date.now(),
    });

    return { clubId };
  },
});
