import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { r2 } from "./r2";

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    videoKey: v.string(),
    thumbnailKey: v.optional(v.string()),
    durationMinutes: v.number(),
  },
  returns: v.object({
    timelapseId: v.id("timelapses"),
  }),
  handler: async (ctx, args) => {
    const timelapseId = await ctx.db.insert("timelapses", {
      projectId: args.projectId,
      videoKey: args.videoKey,
      thumbnailKey: args.thumbnailKey,
      durationMinutes: args.durationMinutes,
      uploadedAt: Date.now(),
      viewCount: 0,
      likeCount: 0,
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

export const listByProject = query({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.array(
    v.object({
      _id: v.id("timelapses"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      videoKey: v.string(),
      thumbnailKey: v.optional(v.string()),
      durationMinutes: v.number(),
      uploadedAt: v.number(),
      viewCount: v.number(),
      likeCount: v.number(),
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

    // Enrich with project titles
    const enrichedPage: Array<{
      _id: any;
      _creationTime: number;
      projectId: any;
      projectTitle: string;
      videoKey: string;
      thumbnailKey?: string;
      durationMinutes: number;
      uploadedAt: number;
      viewCount: number;
      likeCount: number;
    }> = [];

    for (const timelapse of result.page) {
      const project = await ctx.db.get(timelapse.projectId);
      enrichedPage.push({
        ...timelapse,
        projectTitle: project?.title || "Unknown Project",
      });
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
      projectId: v.id("projects"),
      projectTitle: v.string(),
      videoKey: v.string(),
      thumbnailKey: v.optional(v.string()),
      durationMinutes: v.number(),
      uploadedAt: v.number(),
      viewCount: v.number(),
      likeCount: v.number(),
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

