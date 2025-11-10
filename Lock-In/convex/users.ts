import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId, getAuthUserIdOrNull } from "./authHelpers";
import type { Id } from "./_generated/dataModel";

/**
 * Update the authenticated user's profile with username and other details.
 * Called after initial sign-up to complete the user profile.
 */
export const setupProfile = mutation({
  args: {
    username: v.string(),
    displayName: v.string(),
    bio: v.optional(v.string()),
    location: v.optional(v.string()),
  },
  returns: v.object({
    userId: v.id("users"),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    // Check if username already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .first();

    if (existing && existing._id !== userId) {
      throw new Error("Username already taken");
    }

    // Validate username format (alphanumeric + underscores, 3-20 chars)
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(args.username)) {
      throw new Error(
        "Username must be 3-20 characters and contain only letters, numbers, and underscores"
      );
    }

    // Validate display name length
    if (args.displayName.length < 1 || args.displayName.length > 50) {
      throw new Error("Display name must be 1-50 characters");
    }

    await ctx.db.patch(userId, {
      username: args.username,
      displayName: args.displayName,
      bio: args.bio,
      location: args.location,
      createdAt: Date.now(),
    });

    return { userId };
  },
});

/**
 * Get the current authenticated user's data
 */
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserIdOrNull(ctx);
    console.log('[getCurrentUser] userId from auth:', userId);
    if (!userId) {
      console.log('[getCurrentUser] No auth identity, returning null');
      return null;
    }
    const user = await ctx.db.get(userId);
    console.log('[getCurrentUser] Found user:', user);
    return user;
  },
});

export const getUser = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      username: v.optional(v.string()),
      displayName: v.optional(v.string()),
      email: v.optional(v.string()),
      bio: v.optional(v.string()),
      avatarKey: v.optional(v.string()),
      location: v.optional(v.string()),
      createdAt: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const getUserByUsername = query({
  args: {
    username: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      username: v.optional(v.string()),
      displayName: v.optional(v.string()),
      email: v.optional(v.string()),
      bio: v.optional(v.string()),
      avatarKey: v.optional(v.string()),
      location: v.optional(v.string()),
      createdAt: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .first();
  },
});

export const updateProfile = mutation({
  args: {
    displayName: v.optional(v.string()),
    bio: v.optional(v.string()),
    email: v.optional(v.string()),
    location: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const updates: any = {};

    if (args.displayName !== undefined) {
      if (args.displayName.length < 1 || args.displayName.length > 50) {
        throw new Error("Display name must be 1-50 characters");
      }
      updates.displayName = args.displayName;
    }

    if (args.bio !== undefined) {
      updates.bio = args.bio;
    }

    if (args.email !== undefined) {
      updates.email = args.email;
    }

    if (args.location !== undefined) {
      updates.location = args.location;
    }

    await ctx.db.patch(userId, updates);
    return null;
  },
});

export const updateAvatar = mutation({
  args: {
    avatarKey: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    await ctx.db.patch(userId, {
      avatarKey: args.avatarKey,
    });

    return null;
  },
});

export const searchUsers = query({
  args: {
    searchTerm: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      username: v.optional(v.string()),
      displayName: v.optional(v.string()),
      avatarKey: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const allUsers = await ctx.db.query("users").collect();

    const searchLower = args.searchTerm.toLowerCase();
    const filtered = allUsers.filter(
      (user) =>
        user.username?.toLowerCase().includes(searchLower) ||
        user.displayName?.toLowerCase().includes(searchLower)
    );

    return filtered.slice(0, 10).map((user) => ({
      _id: user._id,
      _creationTime: user._creationTime,
      username: user.username,
      displayName: user.displayName,
      avatarKey: user.avatarKey,
    }));
  },
});

