import { R2 } from "@convex-dev/r2";
import { components } from "./_generated/api";
import { v } from "convex/values";

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
export const getVideoUrl = async (key: string, expiresIn?: number) => {
  return await r2.getUrl(key, {
    expiresIn: expiresIn || 60 * 60 * 24, // 24 hours default
  });
};

