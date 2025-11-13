import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Better Auth will create its own tables (user, session, account, etc.)
// We keep our custom users table with Lock-In specific fields
export default defineSchema({
  users: defineTable({
    // Custom Lock-In fields
    username: v.optional(v.string()),
    displayName: v.optional(v.string()),
    email: v.optional(v.string()),
    bio: v.optional(v.string()),
    avatarKey: v.optional(v.string()),
    location: v.optional(v.string()),
    createdAt: v.optional(v.number()),
  })
    .index("by_username", ["username"])
    .index("by_email", ["email"]),

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
    challengeId: v.optional(v.id("challenges")), // Link timelapse to a challenge
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
    .index("by_processing_status", ["processingStatus"])
    .index("by_challenge", ["challengeId"]),

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
    clubId: v.optional(v.id("clubs")), // Link challenge to a club (club-only challenge)
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
    .index("by_dates", ["startDate", "endDate"])
    .index("by_club", ["clubId"]),

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

  // Phase 6: Chunked parallel processing jobs
  processingJobs: defineTable({
    timelapseId: v.id("timelapses"),
    totalChunks: v.number(),
    chunkSize: v.number(), // Size of each chunk in bytes
    uploadedChunks: v.array(v.string()), // Array of R2 keys for uploaded chunks
    processedChunks: v.array(v.string()), // Array of R2 keys for processed chunks
    status: v.union(
      v.literal("uploading"),
      v.literal("processing"),
      v.literal("stitching"),
      v.literal("complete"),
      v.literal("failed")
    ),
    finalVideoKey: v.optional(v.string()), // Final stitched video key in R2
    error: v.optional(v.string()), // Error message if failed
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_timelapse", ["timelapseId"])
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"]),
});
