import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { r2 } from "./r2";

export const create = mutation({
  args: {
    userId: v.id("users"),
    projectId: v.id("projects"),
    videoKey: v.string(),
    thumbnailKey: v.optional(v.string()),
    durationMinutes: v.number(),
    isTimelapse: v.optional(v.boolean()),
    speedMultiplier: v.optional(v.number()),
    originalDuration: v.optional(v.number()),
    videoWidth: v.optional(v.number()),
    videoHeight: v.optional(v.number()),
    requestProcessing: v.optional(v.boolean()), // True if user wants server-side processing
  },
  returns: v.object({
    timelapseId: v.id("timelapses"),
  }),
  handler: async (ctx, args) => {
    const timelapseId = await ctx.db.insert("timelapses", {
      userId: args.userId,
      projectId: args.projectId,
      videoKey: args.videoKey,
      originalVideoKey: args.requestProcessing ? args.videoKey : undefined,
      thumbnailKey: args.thumbnailKey,
      durationMinutes: args.durationMinutes,
      uploadedAt: Date.now(),
      viewCount: 0,
      likeCount: 0,
      isTimelapse: args.isTimelapse ?? false,
      speedMultiplier: args.speedMultiplier,
      originalDuration: args.originalDuration,
      videoWidth: args.videoWidth,
      videoHeight: args.videoHeight,
      processingStatus: args.requestProcessing ? "pending" : undefined,
    });

    // Update project's completed hours
    const project = await ctx.db.get(args.projectId);
    if (project) {
      const newCompletedHours =
        project.completedHours + args.durationMinutes / 60;
      await ctx.db.patch(args.projectId, {
        completedHours: newCompletedHours,
        // Auto-complete project if target is reached
        status:
          newCompletedHours >= project.targetHours
            ? ("completed" as const)
            : project.status,
      });
    }

    return { timelapseId };
  },
});

export const updateProcessingStatus = mutation({
  args: {
    timelapseId: v.id("timelapses"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("complete"),
      v.literal("failed")
    ),
    processedVideoKey: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const timelapse = await ctx.db.get(args.timelapseId);
    if (!timelapse) return null;

    const updates: any = {
      processingStatus: args.status,
    };

    if (args.processedVideoKey) {
      updates.processedVideoKey = args.processedVideoKey;
      updates.videoKey = args.processedVideoKey; // Use processed video as main video
    }

    if (args.error) {
      updates.processingError = args.error;
    }

    await ctx.db.patch(args.timelapseId, updates);
    return null;
  },
});

// Internal mutation that can be called from HTTP actions
export const updateProcessingStatusInternal = internalMutation({
  args: {
    timelapseId: v.id("timelapses"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("complete"),
      v.literal("failed")
    ),
    processedVideoKey: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const timelapse = await ctx.db.get(args.timelapseId);
    if (!timelapse) return null;

    const updates: any = {
      processingStatus: args.status,
    };

    if (args.processedVideoKey) {
      updates.processedVideoKey = args.processedVideoKey;
      updates.videoKey = args.processedVideoKey; // Use processed video as main video
    }

    if (args.error) {
      updates.processingError = args.error;
    }

    await ctx.db.patch(args.timelapseId, updates);
    return null;
  },
});

// Internal mutation for updating thumbnail
export const updateThumbnailInternal = internalMutation({
  args: {
    timelapseId: v.id("timelapses"),
    thumbnailKey: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const timelapse = await ctx.db.get(args.timelapseId);
    if (!timelapse) return null;

    await ctx.db.patch(args.timelapseId, {
      thumbnailKey: args.thumbnailKey,
    });
    return null;
  },
});

export const listByProject = query({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.array(
    v.object({
      _id: v.id("timelapses"),
      _creationTime: v.number(),
      userId: v.id("users"),
      projectId: v.id("projects"),
      videoKey: v.string(),
      originalVideoKey: v.optional(v.string()),
      processedVideoKey: v.optional(v.string()),
      thumbnailKey: v.optional(v.string()),
      durationMinutes: v.number(),
      uploadedAt: v.number(),
      viewCount: v.number(),
      likeCount: v.number(),
      isTimelapse: v.optional(v.boolean()),
      speedMultiplier: v.optional(v.number()),
      originalDuration: v.optional(v.number()),
      videoWidth: v.optional(v.number()),
      videoHeight: v.optional(v.number()),
      processingStatus: v.optional(
        v.union(
          v.literal("pending"),
          v.literal("processing"),
          v.literal("complete"),
          v.literal("failed")
        )
      ),
      processingError: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("timelapses")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();
  },
});

export const listFeed = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("timelapses")
      .withIndex("by_uploaded")
      .order("desc")
      .paginate(args.paginationOpts);

    // Enrich with project titles and user info
    const enrichedPage = [];

    for (const timelapse of result.page) {
      const project = await ctx.db.get(timelapse.projectId);
      const user = await ctx.db.get(timelapse.userId);

      if (user) {
        enrichedPage.push({
          ...timelapse,
          projectTitle: project?.title || "Unknown Project",
          user: {
            username: user.username,
            displayName: user.displayName,
            avatarKey: user.avatarKey,
          },
        });
      }
    }

    return {
      ...result,
      page: enrichedPage,
    };
  },
});

export const get = query({
  args: {
    timelapseId: v.id("timelapses"),
  },
  returns: v.union(
    v.object({
      _id: v.id("timelapses"),
      _creationTime: v.number(),
      userId: v.id("users"),
      projectId: v.id("projects"),
      projectTitle: v.string(),
      videoKey: v.string(),
      originalVideoKey: v.optional(v.string()),
      processedVideoKey: v.optional(v.string()),
      thumbnailKey: v.optional(v.string()),
      durationMinutes: v.number(),
      uploadedAt: v.number(),
      viewCount: v.number(),
      likeCount: v.number(),
      isTimelapse: v.optional(v.boolean()),
      speedMultiplier: v.optional(v.number()),
      originalDuration: v.optional(v.number()),
      videoWidth: v.optional(v.number()),
      videoHeight: v.optional(v.number()),
      processingStatus: v.optional(
        v.union(
          v.literal("pending"),
          v.literal("processing"),
          v.literal("complete"),
          v.literal("failed")
        )
      ),
      processingError: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const timelapse = await ctx.db.get(args.timelapseId);
    if (!timelapse) return null;

    const project = await ctx.db.get(timelapse.projectId);

    return {
      ...timelapse,
      projectTitle: project?.title || "Unknown Project",
    };
  },
});

export const incrementViewCount = mutation({
  args: {
    timelapseId: v.id("timelapses"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const timelapse = await ctx.db.get(args.timelapseId);
    if (!timelapse) return null;

    await ctx.db.patch(args.timelapseId, {
      viewCount: timelapse.viewCount + 1,
    });
    return null;
  },
});

export const deleteTimelapse = mutation({
  args: {
    timelapseId: v.id("timelapses"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const timelapse = await ctx.db.get(args.timelapseId);
    if (!timelapse) return null;

    // Delete from R2
    await r2.deleteObject(ctx, timelapse.videoKey);
    if (timelapse.thumbnailKey) {
      await r2.deleteObject(ctx, timelapse.thumbnailKey);
    }

    // Delete likes
    const likes = await ctx.db
      .query("likes")
      .withIndex("by_timelapse", (q) => q.eq("timelapseId", args.timelapseId))
      .collect();
    for (const like of likes) {
      await ctx.db.delete(like._id);
    }

    // Delete comments
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_timelapse", (q) => q.eq("timelapseId", args.timelapseId))
      .collect();
    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }

    // Update project's completed hours
    const project = await ctx.db.get(timelapse.projectId);
    if (project) {
      const newCompletedHours =
        project.completedHours - timelapse.durationMinutes / 60;
      await ctx.db.patch(timelapse.projectId, {
        completedHours: Math.max(0, newCompletedHours),
      });
    }

    // Delete the timelapse
    await ctx.db.delete(args.timelapseId);
    return null;
  },
});

