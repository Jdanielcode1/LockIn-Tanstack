import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

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
    userId: v.id("users"),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Check if already a member
    const existing = await ctx.db
      .query("clubMembers")
      .withIndex("by_club_and_user", (q) =>
        q.eq("clubId", args.clubId).eq("userId", args.userId)
      )
      .first();

    if (existing) {
      return { success: false };
    }

    // Add member
    await ctx.db.insert("clubMembers", {
      clubId: args.clubId,
      userId: args.userId,
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
    userId: v.id("users"),
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query("clubMembers")
      .withIndex("by_club_and_user", (q) =>
        q.eq("clubId", args.clubId).eq("userId", args.userId)
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
    creatorId: v.id("users"),
    isPublic: v.boolean(),
  },
  returns: v.object({
    clubId: v.id("clubs"),
  }),
  handler: async (ctx, args) => {
    const clubId = await ctx.db.insert("clubs", {
      name: args.name,
      description: args.description,
      type: args.type,
      creatorId: args.creatorId,
      memberCount: 1, // Creator is first member
      isPublic: args.isPublic,
      createdAt: Date.now(),
    });

    // Add creator as admin member
    await ctx.db.insert("clubMembers", {
      clubId,
      userId: args.creatorId,
      role: "admin",
      joinedAt: Date.now(),
    });

    return { clubId };
  },
});
