import { v } from "convex/values";
import { query } from "./_generated/server";

export const getLeaderboard = query({
  args: {
    period: v.union(
      v.literal("day"),
      v.literal("week"),
      v.literal("month"),
      v.literal("year")
    ),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      userId: v.id("users"),
      username: v.string(),
      displayName: v.string(),
      avatarKey: v.optional(v.string()),
      uploadCount: v.number(),
      totalHours: v.number(),
      rank: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    const now = Date.now();
    let startTime = 0;

    // Calculate start time based on period
    switch (args.period) {
      case "day":
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        startTime = startOfDay.getTime();
        break;
      case "week":
        const startOfWeek = new Date();
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        startTime = startOfWeek.getTime();
        break;
      case "month":
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        startTime = startOfMonth.getTime();
        break;
      case "year":
        const startOfYear = new Date();
        startOfYear.setMonth(0, 1);
        startOfYear.setHours(0, 0, 0, 0);
        startTime = startOfYear.getTime();
        break;
    }

    // Get all timelapses in the time period
    const timelapses = await ctx.db
      .query("timelapses")
      .withIndex("by_uploaded")
      .filter((q) => q.gte(q.field("uploadedAt"), startTime))
      .collect();

    // Group by user and calculate stats
    const userStats = new Map<
      string,
      {
        uploadCount: number;
        totalHours: number;
        user: any;
      }
    >();

    for (const timelapse of timelapses) {
      const userId = timelapse.userId;
      const stats = userStats.get(userId) || {
        uploadCount: 0,
        totalHours: 0,
        user: null,
      };

      stats.uploadCount++;
      stats.totalHours += timelapse.durationMinutes / 60;

      if (!stats.user) {
        stats.user = await ctx.db.get(userId);
      }

      userStats.set(userId, stats);
    }

    // Convert to array and sort by upload count
    const leaderboard = Array.from(userStats.entries())
      .map(([userId, stats]) => ({
        userId: userId as any,
        username: stats.user?.username || "Unknown",
        displayName: stats.user?.displayName || "Unknown",
        avatarKey: stats.user?.avatarKey,
        uploadCount: stats.uploadCount,
        totalHours: Math.round(stats.totalHours * 10) / 10,
        rank: 0, // Will be set below
      }))
      .sort((a, b) => {
        // Primary sort: total hours (descending)
        if (b.totalHours !== a.totalHours) {
          return b.totalHours - a.totalHours;
        }
        // Secondary sort: upload count (descending)
        return b.uploadCount - a.uploadCount;
      })
      .slice(0, limit);

    // Assign ranks
    leaderboard.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return leaderboard;
  },
});
