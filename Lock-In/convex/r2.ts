import { R2 } from "@convex-dev/r2";
import { components } from "./_generated/api";
import { v } from "convex/values";
import { query } from "./_generated/server";

export const r2 = new R2(components.r2);

export const { generateUploadUrl, syncMetadata } = r2.clientApi({
  checkUpload: async (ctx, bucket) => {
    // No auth check for now - anyone can upload
    console.log("Upload check passed for bucket:", bucket);
  },
  onUpload: async (ctx, bucket, key) => {
    console.log("File uploaded to R2:", key);
    // Additional actions can be added here if needed
  },
});

// Helper function to get video URL from R2
// Videos are stored with "videos/" prefix
export const getVideoUrl = query({
  args: {
    videoKey: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    return await r2.getUrl(args.videoKey, {
      expiresIn: 60 * 60 * 24, // 24 hours
    });
  },
});

// Helper function to get avatar URL from R2
// Avatars are stored with "avatars/" prefix
export const getAvatarUrl = query({
  args: {
    avatarKey: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    if (!args.avatarKey || args.avatarKey.trim() === '') {
      return null;
    }
    return await r2.getUrl(args.avatarKey, {
      expiresIn: 60 * 60 * 24 * 7, // 7 days (avatars change less frequently)
    });
  },
});

