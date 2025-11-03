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
    videoKey: v.string(), // Main video to display (processed or original)
    originalVideoKey: v.optional(v.string()), // Original video before processing
    processedVideoKey: v.optional(v.string()), // Processed timelapse video
    thumbnailKey: v.optional(v.string()),
    durationMinutes: v.number(),
    uploadedAt: v.number(),
    viewCount: v.number(),
    likeCount: v.number(),
    isTimelapse: v.optional(v.boolean()),
    speedMultiplier: v.optional(v.number()),
    originalDuration: v.optional(v.number()),
    videoWidth: v.optional(v.number()), // Video width for aspect ratio
    videoHeight: v.optional(v.number()), // Video height for aspect ratio
    processingStatus: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("complete"),
        v.literal("failed")
      )
    ),
    processingError: v.optional(v.string()),
    processingStage: v.optional(v.string()), // Current processing stage
    processingProgress: v.optional(v.number()), // Progress percentage (0-100)
    processingStartedAt: v.optional(v.number()), // When processing started
    processingCompletedAt: v.optional(v.number()), // When processing completed
  })
    .index("by_project", ["projectId"])
    .index("by_uploaded", ["uploadedAt"])
    .index("by_user", ["userId"])
    .index("by_processing_status", ["processingStatus"]),

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

  lockInSessions: defineTable({
    creatorId: v.id("users"),
    projectId: v.optional(v.id("projects")), // Link to project for context
    title: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("scheduled"),
      v.literal("active"),
      v.literal("ended")
    ),
    scheduledStartTime: v.number(),
    actualStartTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
    maxParticipants: v.number(),
    realtimeKitMeetingId: v.optional(v.string()), // Cloudflare RealtimeKit meeting ID
    realtimeKitAuthToken: v.optional(v.string()), // Auth token for joining
    aiAgentEnabled: v.boolean(),
    aiAgentActive: v.optional(v.boolean()),
    sessionType: v.union(
      v.literal("coding"),
      v.literal("study"),
      v.literal("general")
    ),
    createdAt: v.number(),
  })
    .index("by_creator", ["creatorId"])
    .index("by_status", ["status"])
    .index("by_scheduled_time", ["scheduledStartTime"])
    .index("by_project", ["projectId"]),

  sessionParticipants: defineTable({
    sessionId: v.id("lockInSessions"),
    userId: v.id("users"),
    joinedAt: v.number(),
    leftAt: v.optional(v.number()),
    isActive: v.boolean(),
    isModerator: v.boolean(),
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"])
    .index("by_session_and_user", ["sessionId", "userId"]),

  aiAssistanceLogs: defineTable({
    sessionId: v.id("lockInSessions"),
    userId: v.id("users"),
    question: v.string(),
    response: v.string(),
    timestamp: v.number(),
    helpful: v.optional(v.boolean()), // User feedback
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"]),

  follows: defineTable({
    followerId: v.id("users"), // User who is following
    followingId: v.id("users"), // User being followed
    createdAt: v.number(),
  })
    .index("by_follower", ["followerId"])
    .index("by_following", ["followingId"])
    .index("by_follower_and_following", ["followerId", "followingId"]),

  clubs: defineTable({
    name: v.string(),
    description: v.string(),
    creatorId: v.id("users"),
    memberCount: v.number(),
    type: v.union(
      v.literal("coding"),
      v.literal("study"),
      v.literal("fitness"),
      v.literal("general")
    ),
    isPublic: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_creator", ["creatorId"])
    .index("by_type", ["type"])
    .index("by_public", ["isPublic"]),

  clubMembers: defineTable({
    clubId: v.id("clubs"),
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member")),
    joinedAt: v.number(),
  })
    .index("by_club", ["clubId"])
    .index("by_user", ["userId"])
    .index("by_club_and_user", ["clubId", "userId"]),
});
