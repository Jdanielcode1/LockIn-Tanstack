import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

export const toggleLike = mutation({
  args: {
    timelapseId: v.id("timelapses"),
  },
  returns: v.object({
    liked: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // For now, without auth, we'll just toggle the like count
    // In a real app with auth, we'd check if the user has already liked
    
    // Simple implementation: check if any like exists (this is not ideal without user auth)
    // For MVP, we'll just increment/decrement
    const timelapse = await ctx.db.get(args.timelapseId);
    if (!timelapse) {
      throw new Error("Timelapse not found");
    }

    // For this MVP without auth, we'll just add a like
    const existingLike = await ctx.db
      .query("likes")
      .withIndex("by_timelapse", (q) => q.eq("timelapseId", args.timelapseId))
      .first();

    if (existingLike) {
      // Unlike (for demo purposes, delete first like)
      await ctx.db.delete(existingLike._id);
      await ctx.db.patch(args.timelapseId, {
        likeCount: Math.max(0, timelapse.likeCount - 1),
      });
      return { liked: false };
    } else {
      // Like
      await ctx.db.insert("likes", {
        timelapseId: args.timelapseId,
        createdAt: Date.now(),
      });
      await ctx.db.patch(args.timelapseId, {
        likeCount: timelapse.likeCount + 1,
      });
      return { liked: true };
    }
  },
});

export const addComment = mutation({
  args: {
    timelapseId: v.id("timelapses"),
    content: v.string(),
  },
  returns: v.object({
    commentId: v.id("comments"),
  }),
  handler: async (ctx, args) => {
    const commentId = await ctx.db.insert("comments", {
      timelapseId: args.timelapseId,
      content: args.content,
      createdAt: Date.now(),
    });

    return { commentId };
  },
});

export const getComments = query({
  args: {
    timelapseId: v.id("timelapses"),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("comments")
      .withIndex("by_timelapse", (q) => q.eq("timelapseId", args.timelapseId))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const deleteComment = mutation({
  args: {
    commentId: v.id("comments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.commentId);
    return null;
  },
});

export const isLiked = query({
  args: {
    timelapseId: v.id("timelapses"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    // Without auth, we'll check if any like exists
    const like = await ctx.db
      .query("likes")
      .withIndex("by_timelapse", (q) => q.eq("timelapseId", args.timelapseId))
      .first();
    
    return like !== null;
  },
});

