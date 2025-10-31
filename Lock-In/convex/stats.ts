import { v } from "convex/values";
import { query } from "./_generated/server";

export const getOverallStats = query({
  args: {
    userId: v.optional(v.id("users")),
  },
  returns: v.object({
    totalProjects: v.number(),
    activeProjects: v.number(),
    completedProjects: v.number(),
    totalHours: v.number(),
    totalTimelapses: v.number(),
    totalViews: v.number(),
    totalLikes: v.number(),
    completionRate: v.number(),
  }),
  handler: async (ctx, args) => {
    let projects;
    let timelapses;

    if (args.userId) {
      // Get stats for specific user
      const userId = args.userId; // Extract to const for type narrowing
      projects = await ctx.db
        .query("projects")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      
      timelapses = await ctx.db
        .query("timelapses")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
    } else {
      // Get global stats
      projects = await ctx.db.query("projects").collect();
      timelapses = await ctx.db.query("timelapses").collect();
    }

    const totalProjects = projects.length;
    const activeProjects = projects.filter((p) => p.status === "active").length;
    const completedProjects = projects.filter(
      (p) => p.status === "completed"
    ).length;

    const totalHours = projects.reduce(
      (sum, p) => sum + p.completedHours,
      0
    );

    const totalTimelapses = timelapses.length;
    const totalViews = timelapses.reduce((sum, t) => sum + t.viewCount, 0);
    const totalLikes = timelapses.reduce((sum, t) => sum + t.likeCount, 0);

    const completionRate =
      totalProjects > 0 ? (completedProjects / totalProjects) * 100 : 0;

    return {
      totalProjects,
      activeProjects,
      completedProjects,
      totalHours: Math.round(totalHours * 10) / 10,
      totalTimelapses,
      totalViews,
      totalLikes,
      completionRate: Math.round(completionRate),
    };
  },
});

export const getActivityFeed = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      id: v.string(),
      type: v.union(
        v.literal("project_created"),
        v.literal("timelapse_uploaded"),
        v.literal("project_completed")
      ),
      projectTitle: v.string(),
      timestamp: v.number(),
      details: v.optional(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit || 15;
    const activities: Array<{
      id: string;
      type: "project_created" | "timelapse_uploaded" | "project_completed";
      projectTitle: string;
      timestamp: number;
      details?: string;
    }> = [];

    // Get recent projects
    const recentProjects = await ctx.db
      .query("projects")
      .order("desc")
      .take(10);

    for (const project of recentProjects) {
      activities.push({
        id: `project-${project._id}`,
        type: "project_created",
        projectTitle: project.title,
        timestamp: project.createdAt,
      });

      if (project.status === "completed") {
        activities.push({
          id: `completed-${project._id}`,
          type: "project_completed",
          projectTitle: project.title,
          timestamp: project._creationTime,
        });
      }
    }

    // Get recent timelapses
    const recentTimelapses = await ctx.db
      .query("timelapses")
      .order("desc")
      .take(20);

    for (const timelapse of recentTimelapses) {
      const project = await ctx.db.get(timelapse.projectId);
      if (project) {
        activities.push({
          id: `timelapse-${timelapse._id}`,
          type: "timelapse_uploaded",
          projectTitle: project.title,
          timestamp: timelapse.uploadedAt,
          details: `${timelapse.durationMinutes} minutes`,
        });
      }
    }

    // Sort by timestamp and limit
    return activities.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
  },
});

export const getContributionData = query({
  args: {
    userId: v.optional(v.id("users")),
    year: v.number(),
  },
  returns: v.array(
    v.object({
      date: v.string(),
      count: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const startOfYear = new Date(args.year, 0, 1).getTime();
    const endOfYear = new Date(args.year, 11, 31, 23, 59, 59).getTime();

    let timelapses;
    if (args.userId) {
      const userId = args.userId; // Extract to const for type narrowing
      timelapses = await ctx.db
        .query("timelapses")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
    } else {
      timelapses = await ctx.db.query("timelapses").collect();
    }

    // Filter timelapses for the year
    const yearTimelapses = timelapses.filter(
      (t) => t.uploadedAt >= startOfYear && t.uploadedAt <= endOfYear
    );

    // Group by date
    const dateMap: Record<string, number> = {};

    for (const timelapse of yearTimelapses) {
      const date = new Date(timelapse.uploadedAt);
      const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD
      dateMap[dateStr] = (dateMap[dateStr] || 0) + 1;
    }

    // Convert to array
    const contributions: Array<{ date: string; count: number }> = [];
    for (const [date, count] of Object.entries(dateMap)) {
      contributions.push({ date, count });
    }

    return contributions.sort((a, b) => a.date.localeCompare(b.date));
  },
});

