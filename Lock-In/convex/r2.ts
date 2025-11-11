import { R2 } from "@convex-dev/r2";
import { components } from "./_generated/api";
import { v } from "convex/values";
import { query, internalQuery } from "./_generated/server";

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
    const expiresIn = 60 * 60 * 24; // 24 hours
    const now = Date.now();
    const expiresAt = new Date(now + expiresIn * 1000);

    console.log('[getVideoUrl] Generating signed URL:', {
      videoKey: args.videoKey,
      expiresInSeconds: expiresIn,
      expiresInHours: expiresIn / 3600,
      expiresAt: expiresAt.toISOString(),
      generatedAt: new Date(now).toISOString()
    });

    const url = await r2.getUrl(args.videoKey, { expiresIn });

    console.log('[getVideoUrl] URL generated:', {
      videoKey: args.videoKey,
      urlPrefix: url.substring(0, 50) + '...',
      hasSignature: url.includes('Signature=')
    });

    return url;
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

// Helper function to get thumbnail URL from R2
// Thumbnails are stored with "thumbnails/" prefix
export const getThumbnailUrl = query({
  args: {
    thumbnailKey: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    if (!args.thumbnailKey || args.thumbnailKey.trim() === '') {
      console.log('[getThumbnailUrl] Empty thumbnail key, returning null');
      return null;
    }

    const expiresIn = 60 * 60 * 24; // 24 hours
    const now = Date.now();
    const expiresAt = new Date(now + expiresIn * 1000);

    console.log('[getThumbnailUrl] Generating signed URL:', {
      thumbnailKey: args.thumbnailKey,
      expiresInSeconds: expiresIn,
      expiresAt: expiresAt.toISOString(),
      generatedAt: new Date(now).toISOString()
    });

    const url = await r2.getUrl(args.thumbnailKey, { expiresIn });

    console.log('[getThumbnailUrl] URL generated:', {
      thumbnailKey: args.thumbnailKey,
      urlPrefix: url.substring(0, 50) + '...'
    });

    return url;
  },
});

// Internal query for getting video URL (callable from HTTP actions)
export const getVideoUrlInternal = internalQuery({
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

