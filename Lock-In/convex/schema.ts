import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    username: v.string(),
    displayName: v.string(),
    email: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatarKey: v.optional(v.string()),
    location: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_username", ["username"]),

  projects: defineTable({
    userId: v.id("users"),
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
  })
    .index("by_status", ["status"])
    .index("by_user", ["userId"])
    .index("by_user_and_status", ["userId", "status"]),

  timelapses: defineTable({
    userId: v.id("users"),
    projectId: v.id("projects"),
    videoKey: v.string(),
    thumbnailKey: v.optional(v.string()),
    durationMinutes: v.number(),
    uploadedAt: v.number(),
    viewCount: v.number(),
    likeCount: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_uploaded", ["uploadedAt"])
    .index("by_user", ["userId"]),

  likes: defineTable({
    userId: v.id("users"),
    timelapseId: v.id("timelapses"),
    createdAt: v.number(),
  })
    .index("by_timelapse", ["timelapseId"])
    .index("by_user_and_timelapse", ["userId", "timelapseId"]),

  comments: defineTable({
    userId: v.id("users"),
    timelapseId: v.id("timelapses"),
    content: v.string(),
    createdAt: v.number(),
  })
    .index("by_timelapse", ["timelapseId"])
    .index("by_user", ["userId"]),

  challenges: defineTable({
    creatorId: v.id("users"),
    title: v.string(),
    description: v.string(),
    type: v.union(
      v.literal("reading"),
      v.literal("study"),
      v.literal("workout"),
      v.literal("custom")
    ),
    goal: v.optional(v.string()), // e.g., "100 hours", "Read 5 books"
    startDate: v.number(),
    endDate: v.number(),
    createdAt: v.number(),
  })
    .index("by_creator", ["creatorId"])
    .index("by_dates", ["startDate", "endDate"]),

  challengeParticipants: defineTable({
    challengeId: v.id("challenges"),
    userId: v.id("users"),
    joinedAt: v.number(),
    progress: v.optional(v.number()), // For tracking progress (e.g., hours completed)
  })
    .index("by_challenge", ["challengeId"])
    .index("by_user", ["userId"])
    .index("by_challenge_and_user", ["challengeId", "userId"]),
});
