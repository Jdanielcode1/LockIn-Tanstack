import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { api } from "./_generated/api";

// Follow a user
export const follow = mutation({
  args: {
    followerId: v.id("users"),
    followingId: v.id("users"),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Check if already following
    const existing = await ctx.db
      .query("follows")
      .withIndex("by_follower_and_following", (q) =>
        q.eq("followerId", args.followerId).eq("followingId", args.followingId)
      )
      .first();

    if (existing) {
      return { success: false };
    }

    // Create follow relationship
    await ctx.db.insert("follows", {
      followerId: args.followerId,
      followingId: args.followingId,
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

// Unfollow a user
export const unfollow = mutation({
  args: {
    followerId: v.id("users"),
    followingId: v.id("users"),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("follows")
      .withIndex("by_follower_and_following", (q) =>
        q.eq("followerId", args.followerId).eq("followingId", args.followingId)
      )
      .first();

    if (!existing) {
      return { success: false };
    }

    await ctx.db.delete(existing._id);
    return { success: true };
  },
});

// Check if user is following another user
export const isFollowing = query({
  args: {
    followerId: v.id("users"),
    followingId: v.id("users"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("follows")
      .withIndex("by_follower_and_following", (q) =>
        q.eq("followerId", args.followerId).eq("followingId", args.followingId)
      )
      .first();

    return !!existing;
  },
});

// Get follower count for a user
export const getFollowerCount = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const followers = await ctx.db
      .query("follows")
      .withIndex("by_following", (q) => q.eq("followingId", args.userId))
      .collect();

    return followers.length;
  },
});

// Get following count for a user
export const getFollowingCount = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const following = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", args.userId))
      .collect();

    return following.length;
  },
});

// Get suggested users to follow
export const getSuggestedUsers = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("users"),
      username: v.string(),
      displayName: v.string(),
      avatarKey: v.optional(v.string()),
      location: v.optional(v.string()),
      mutualFollowersCount: v.number(),
      isActive: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit || 3;

    // Get users the current user is already following
    const following = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", args.userId))
      .collect();

    const followingIds = new Set(following.map((f) => f.followingId));
    followingIds.add(args.userId); // Don't suggest yourself

    // Get all users
    const allUsers = await ctx.db.query("users").collect();

    // Filter out users already being followed
    const suggestions = allUsers.filter((user) => !followingIds.has(user._id));

    // Calculate mutual followers for each suggestion
    const suggestionsWithMutuals = await Promise.all(
      suggestions.map(async (user) => {
        // Get who this suggested user follows
        const theirFollowing = await ctx.db
          .query("follows")
          .withIndex("by_follower", (q) => q.eq("followerId", user._id))
          .collect();

        // Count mutual connections (people both you and they follow)
        const mutualCount = theirFollowing.filter((f) =>
          followingIds.has(f.followingId)
        ).length;

        // Check if user has recent activity (uploaded in last 30 days)
        const recentTimelapses = await ctx.db
          .query("timelapses")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .filter((q) =>
            q.gt(q.field("uploadedAt"), Date.now() - 30 * 24 * 60 * 60 * 1000)
          )
          .collect();

        return {
          _id: user._id,
          username: user.username,
          displayName: user.displayName,
          avatarKey: user.avatarKey,
          location: user.location,
          mutualFollowersCount: mutualCount,
          isActive: recentTimelapses.length > 0,
        };
      })
    );

    // Sort by mutual followers count (desc), then by active status
    suggestionsWithMutuals.sort((a, b) => {
      if (b.mutualFollowersCount !== a.mutualFollowersCount) {
        return b.mutualFollowersCount - a.mutualFollowersCount;
      }
      return (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0);
    });

    return suggestionsWithMutuals.slice(0, limit);
  },
});
