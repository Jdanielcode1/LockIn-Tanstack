import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

export const toggleLike = mutation({
  args: {
    userId: v.id("users"),
    timelapseId: v.id("timelapses"),
  },
  returns: v.object({
    liked: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const timelapse = await ctx.db.get(args.timelapseId);
    if (!timelapse) {
      throw new Error("Timelapse not found");
    }

    // Check if user has already liked this timelapse
    const existingLike = await ctx.db
      .query("likes")
      .withIndex("by_user_and_timelapse", (q) => 
        q.eq("userId", args.userId).eq("timelapseId", args.timelapseId)
      )
      .first();

    if (existingLike) {
      // Unlike
      await ctx.db.delete(existingLike._id);
      await ctx.db.patch(args.timelapseId, {
        likeCount: Math.max(0, timelapse.likeCount - 1),
      });
      return { liked: false };
    } else {
      // Like
      await ctx.db.insert("likes", {
        userId: args.userId,
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
    userId: v.id("users"),
    timelapseId: v.id("timelapses"),
    content: v.string(),
  },
  returns: v.object({
    commentId: v.id("comments"),
  }),
  handler: async (ctx, args) => {
    const commentId = await ctx.db.insert("comments", {
      userId: args.userId,
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
    const result = await ctx.db
      .query("comments")
      .withIndex("by_timelapse", (q) => q.eq("timelapseId", args.timelapseId))
      .order("desc")
      .paginate(args.paginationOpts);

    // Enrich with user info
    const enrichedPage = await Promise.all(
      result.page.map(async (comment) => {
        const user = await ctx.db.get(comment.userId);
        return {
          ...comment,
          user: user
            ? {
                username: user.username,
                displayName: user.displayName,
                avatarKey: user.avatarKey,
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
    userId: v.id("users"),
    timelapseId: v.id("timelapses"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const like = await ctx.db
      .query("likes")
      .withIndex("by_user_and_timelapse", (q) =>
        q.eq("userId", args.userId).eq("timelapseId", args.timelapseId)
      )
      .first();
    
    return like !== null;
  },
});

