import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  projects: defineTable({
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
  }).index("by_status", ["status"]),

  timelapses: defineTable({
    projectId: v.id("projects"),
    videoKey: v.string(), // R2 object key
    thumbnailKey: v.optional(v.string()), // R2 object key for thumbnail
    durationMinutes: v.number(),
    uploadedAt: v.number(),
    viewCount: v.number(),
    likeCount: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_uploaded", ["uploadedAt"]),

  likes: defineTable({
    timelapseId: v.id("timelapses"),
    createdAt: v.number(),
  }).index("by_timelapse", ["timelapseId"]),

  comments: defineTable({
    timelapseId: v.id("timelapses"),
    content: v.string(),
    createdAt: v.number(),
  }).index("by_timelapse", ["timelapseId"]),
});
