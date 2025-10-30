import { v } from "convex/values";
import { query } from "./_generated/server";
import { r2 } from "./r2";

export const getVideoUrl = query({
  args: {
    videoKey: v.string(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    try {
      const url = await r2.getUrl(args.videoKey, {
        expiresIn: 60 * 60 * 24, // 24 hours
      });
      return url;
    } catch (error) {
      console.error("Error getting video URL:", error);
      return null;
    }
  },
});

