import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    targetHours: v.number(),
  },
  returns: v.object({
    projectId: v.id("projects"),
  }),
  handler: async (ctx, args) => {
    const projectId = await ctx.db.insert("projects", {
      title: args.title,
      description: args.description,
      targetHours: args.targetHours,
      completedHours: 0,
      status: "active" as const,
      createdAt: Date.now(),
    });

    return { projectId };
  },
});

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projects")
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

export const get = query({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.union(
    v.object({
      _id: v.id("projects"),
      _creationTime: v.number(),
      title: v.string(),
      description: v.string(),
      targetHours: v.number(),
      completedHours: v.number(),
      status: v.union(
        v.literal("active"),
        v.literal("completed"),
        v.literal("paused")
      ),
      createdAt: v.number(),
      timelapseCount: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) return null;

    const timelapses = await ctx.db
      .query("timelapses")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    return {
      ...project,
      timelapseCount: timelapses.length,
    };
  },
});

export const updateStatus = mutation({
  args: {
    projectId: v.id("projects"),
    status: v.union(
      v.literal("active"),
      v.literal("completed"),
      v.literal("paused")
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.projectId, {
      status: args.status,
    });
    return null;
  },
});

export const deleteProject = mutation({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get all timelapses for this project
    const timelapses = await ctx.db
      .query("timelapses")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Delete all timelapses and their associated data
    for (const timelapse of timelapses) {
      // Delete likes
      const likes = await ctx.db
        .query("likes")
        .withIndex("by_timelapse", (q) => q.eq("timelapseId", timelapse._id))
        .collect();
      for (const like of likes) {
        await ctx.db.delete(like._id);
      }

      // Delete comments
      const comments = await ctx.db
        .query("comments")
        .withIndex("by_timelapse", (q) => q.eq("timelapseId", timelapse._id))
        .collect();
      for (const comment of comments) {
        await ctx.db.delete(comment._id);
      }

      // Delete timelapse
      await ctx.db.delete(timelapse._id);
    }

    // Delete the project
    await ctx.db.delete(args.projectId);
    return null;
  },
});

