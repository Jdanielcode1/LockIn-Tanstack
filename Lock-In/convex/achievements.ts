import { v } from "convex/values";
import { query } from "./_generated/server";

export type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt?: number;
  progress?: number;
  maxProgress?: number;
};

// Calculate and return user achievements
export const getUserAchievements = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      description: v.string(),
      icon: v.string(),
      earned: v.boolean(),
      earnedAt: v.optional(v.number()),
      progress: v.optional(v.number()),
      maxProgress: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args): Promise<Achievement[]> => {
    // Get user data
    const user = await ctx.db.get(args.userId);
    if (!user) return [];

    // Get user stats
    const timelapses = await ctx.db
      .query("timelapses")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const totalHours = timelapses.reduce(
      (sum, t) => sum + (t.durationMinutes / 60),
      0
    );

    const completedProjects = projects.filter((p) => p.status === "completed");

    // Get followers
    const followers = await ctx.db
      .query("follows")
      .withIndex("by_following", (q) => q.eq("followingId", args.userId))
      .collect();

    // Get challenges
    const challengeParticipations = await ctx.db
      .query("challengeParticipants")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Define achievements
    const achievements: Achievement[] = [
      {
        id: "first_upload",
        name: "First Steps",
        description: "Uploaded your first timelapse",
        icon: "🎬",
        earned: timelapses.length > 0,
        earnedAt: timelapses.length > 0 ? timelapses[0].uploadedAt : undefined,
      },
      {
        id: "ten_uploads",
        name: "Getting Started",
        description: "Uploaded 10 timelapses",
        icon: "📹",
        earned: timelapses.length >= 10,
        earnedAt:
          timelapses.length >= 10
            ? timelapses[9].uploadedAt
            : undefined,
        progress: timelapses.length,
        maxProgress: 10,
      },
      {
        id: "fifty_uploads",
        name: "Content Creator",
        description: "Uploaded 50 timelapses",
        icon: "🎥",
        earned: timelapses.length >= 50,
        progress: timelapses.length,
        maxProgress: 50,
      },
      {
        id: "century_club",
        name: "Century Club",
        description: "Logged 100+ hours",
        icon: "💯",
        earned: totalHours >= 100,
        progress: Math.floor(totalHours),
        maxProgress: 100,
      },
      {
        id: "thousand_hours",
        name: "Master",
        description: "Logged 1,000+ hours",
        icon: "🏆",
        earned: totalHours >= 1000,
        progress: Math.floor(totalHours),
        maxProgress: 1000,
      },
      {
        id: "first_project",
        name: "Project Starter",
        description: "Created your first project",
        icon: "📁",
        earned: projects.length > 0,
        earnedAt: projects.length > 0 ? projects[0].createdAt : undefined,
      },
      {
        id: "project_completer",
        name: "Finisher",
        description: "Completed a project",
        icon: "✅",
        earned: completedProjects.length > 0,
        earnedAt:
          completedProjects.length > 0
            ? completedProjects[0].createdAt
            : undefined,
      },
      {
        id: "social_butterfly",
        name: "Social Butterfly",
        description: "Get 10+ followers",
        icon: "🦋",
        earned: followers.length >= 10,
        progress: followers.length,
        maxProgress: 10,
      },
      {
        id: "influencer",
        name: "Influencer",
        description: "Get 50+ followers",
        icon: "⭐",
        earned: followers.length >= 50,
        progress: followers.length,
        maxProgress: 50,
      },
      {
        id: "challenge_joiner",
        name: "Challenge Accepted",
        description: "Joined your first challenge",
        icon: "🎯",
        earned: challengeParticipations.length > 0,
        earnedAt:
          challengeParticipations.length > 0
            ? challengeParticipations[0].joinedAt
            : undefined,
      },
      {
        id: "challenge_champion",
        name: "Challenge Champion",
        description: "Joined 5+ challenges",
        icon: "🏅",
        earned: challengeParticipations.length >= 5,
        progress: challengeParticipations.length,
        maxProgress: 5,
      },
      {
        id: "early_adopter",
        name: "Early Adopter",
        description: "One of the first 100 users",
        icon: "🚀",
        earned: user.createdAt < Date.now() - 90 * 24 * 60 * 60 * 1000, // Created more than 90 days ago as proxy
      },
    ];

    return achievements;
  },
});
