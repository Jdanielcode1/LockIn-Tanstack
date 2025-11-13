/**
 * Phase 6: Chunked Parallel Processing Jobs
 *
 * This module manages the orchestration of chunked video processing,
 * using Convex for state tracking to avoid Durable Object timeout issues.
 */

import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Create a new processing job for chunked video upload
 *
 * Called by the frontend when starting a chunked upload
 */
export const createProcessingJob = mutation({
  args: {
    timelapseId: v.id("timelapses"),
    totalChunks: v.number(),
    chunkSize: v.number(),
  },
  handler: async (ctx, args) => {
    const jobId = await ctx.db.insert("processingJobs", {
      timelapseId: args.timelapseId,
      totalChunks: args.totalChunks,
      chunkSize: args.chunkSize,
      uploadedChunks: [],
      processedChunks: [],
      status: "uploading",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    console.log(`Created processing job ${jobId} for timelapse ${args.timelapseId} with ${args.totalChunks} chunks`);

    return jobId;
  },
});

/**
 * Mark a chunk as uploaded
 *
 * Called by the frontend after each chunk is uploaded to R2
 */
export const markChunkUploaded = mutation({
  args: {
    jobId: v.id("processingJobs"),
    chunkIndex: v.number(),
    chunkKey: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error(`Processing job ${args.jobId} not found`);
    }

    // Add chunk key at the correct index
    const uploadedChunks = [...job.uploadedChunks];
    uploadedChunks[args.chunkIndex] = args.chunkKey;

    await ctx.db.patch(args.jobId, {
      uploadedChunks,
      updatedAt: Date.now(),
    });

    console.log(`Job ${args.jobId}: Chunk ${args.chunkIndex} uploaded (${uploadedChunks.filter(Boolean).length}/${job.totalChunks})`);

    // Check if all chunks are uploaded
    if (uploadedChunks.filter(Boolean).length === job.totalChunks) {
      console.log(`Job ${args.jobId}: All chunks uploaded, starting processing`);
      // Trigger processing start
      await ctx.scheduler.runAfter(0, internal.processingJobs.startChunkProcessingInternal, {
        jobId: args.jobId,
      });
    }

    return {
      uploaded: uploadedChunks.filter(Boolean).length,
      total: job.totalChunks,
    };
  },
});

/**
 * Internal mutation to start chunk processing
 *
 * This is called by the scheduler after all chunks are uploaded
 */
export const startChunkProcessingInternal = internalMutation({
  args: {
    jobId: v.id("processingJobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error(`Processing job ${args.jobId} not found`);
    }

    await ctx.db.patch(args.jobId, {
      status: "processing",
      processedChunks: new Array(job.totalChunks).fill(""), // Initialize array
      updatedAt: Date.now(),
    });

    // Update timelapse status
    await ctx.db.patch(job.timelapseId, {
      processingStatus: "processing",
      processingStage: "Processing chunks in parallel",
      processingProgress: 0,
    });

    console.log(`Job ${args.jobId}: Status updated to processing`);
  },
});

/**
 * Mark a chunk as processed
 *
 * Called by the container after processing a chunk
 */
export const markChunkProcessed = mutation({
  args: {
    jobId: v.id("processingJobs"),
    chunkIndex: v.number(),
    processedKey: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error(`Processing job ${args.jobId} not found`);
    }

    // Add processed chunk key at the correct index
    const processedChunks = [...job.processedChunks];
    processedChunks[args.chunkIndex] = args.processedKey;

    const processedCount = processedChunks.filter(Boolean).length;
    const progress = Math.round((processedCount / job.totalChunks) * 100);

    await ctx.db.patch(args.jobId, {
      processedChunks,
      updatedAt: Date.now(),
    });

    // Update timelapse progress
    await ctx.db.patch(job.timelapseId, {
      processingProgress: progress,
    });

    console.log(`Job ${args.jobId}: Chunk ${args.chunkIndex} processed (${processedCount}/${job.totalChunks}, ${progress}%)`);

    // Check if all chunks are processed
    if (processedCount === job.totalChunks) {
      console.log(`Job ${args.jobId}: All chunks processed, triggering stitching`);
      // Trigger stitching
      await ctx.scheduler.runAfter(0, internal.processingJobs.triggerStitchingInternal, {
        jobId: args.jobId,
      });
    }

    return {
      processed: processedCount,
      total: job.totalChunks,
      progress,
    };
  },
});

/**
 * Internal mutation to trigger stitching
 *
 * This calls the Worker to start the stitching process
 */
export const triggerStitchingInternal = internalMutation({
  args: {
    jobId: v.id("processingJobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error(`Processing job ${args.jobId} not found`);
    }

    await ctx.db.patch(args.jobId, {
      status: "stitching",
      updatedAt: Date.now(),
    });

    // Update timelapse status
    await ctx.db.patch(job.timelapseId, {
      processingStage: "Stitching final video",
      processingProgress: 100,
    });

    // Trigger stitching via HTTP action (which will call the Worker)
    const workerUrl = process.env.VITE_WORKER_URL;
    if (!workerUrl) {
      throw new Error("VITE_WORKER_URL not configured");
    }

    console.log(`Job ${args.jobId}: Triggering stitching at ${workerUrl}/stitch`);

    try {
      const response = await fetch(`${workerUrl}/stitch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: args.jobId,
          processedChunkKeys: job.processedChunks,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Stitching request failed: ${error}`);
      }

      console.log(`Job ${args.jobId}: Stitching triggered successfully`);
    } catch (error: any) {
      console.error(`Job ${args.jobId}: Failed to trigger stitching:`, error);
      await ctx.db.patch(args.jobId, {
        status: "failed",
        error: error.message,
      });
      await ctx.db.patch(job.timelapseId, {
        processingStatus: "failed",
        processingError: `Stitching trigger failed: ${error.message}`,
      });
    }
  },
});

/**
 * Mark a job as complete
 *
 * Called by the container after stitching is complete
 */
export const markJobComplete = mutation({
  args: {
    jobId: v.id("processingJobs"),
    finalVideoKey: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error(`Processing job ${args.jobId} not found`);
    }

    await ctx.db.patch(args.jobId, {
      status: "complete",
      finalVideoKey: args.finalVideoKey,
      updatedAt: Date.now(),
    });

    // Update timelapse with final video
    await ctx.db.patch(job.timelapseId, {
      processedVideoKey: args.finalVideoKey,
      videoKey: args.finalVideoKey, // Update main video key
      processingStatus: "complete",
      processingStage: "Complete",
      processingProgress: 100,
      processingCompletedAt: Date.now(),
    });

    console.log(`Job ${args.jobId}: Marked complete with final video ${args.finalVideoKey}`);

    return { success: true };
  },
});

/**
 * Mark a job as failed
 *
 * Called when an error occurs during processing
 */
export const markJobFailed = mutation({
  args: {
    jobId: v.id("processingJobs"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error(`Processing job ${args.jobId} not found`);
    }

    await ctx.db.patch(args.jobId, {
      status: "failed",
      error: args.error,
      updatedAt: Date.now(),
    });

    // Update timelapse status
    await ctx.db.patch(job.timelapseId, {
      processingStatus: "failed",
      processingError: args.error,
    });

    console.log(`Job ${args.jobId}: Marked failed - ${args.error}`);

    return { success: true };
  },
});

/**
 * Get job status
 *
 * Called by the frontend to poll for progress
 */
export const getJobStatus = query({
  args: {
    jobId: v.id("processingJobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      return null;
    }

    const uploadedCount = job.uploadedChunks.filter(Boolean).length;
    const processedCount = job.processedChunks.filter(Boolean).length;

    return {
      ...job,
      uploadProgress: Math.round((uploadedCount / job.totalChunks) * 100),
      processingProgress: Math.round((processedCount / job.totalChunks) * 100),
      uploadedCount,
      processedCount,
    };
  },
});

/**
 * Get job by timelapse ID
 *
 * Useful for finding the job associated with a timelapse
 */
export const getJobByTimelapse = query({
  args: {
    timelapseId: v.id("timelapses"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query("processingJobs")
      .withIndex("by_timelapse", (q) => q.eq("timelapseId", args.timelapseId))
      .order("desc")
      .first();

    if (!job) {
      return null;
    }

    const uploadedCount = job.uploadedChunks.filter(Boolean).length;
    const processedCount = job.processedChunks.filter(Boolean).length;

    return {
      ...job,
      uploadProgress: Math.round((uploadedCount / job.totalChunks) * 100),
      processingProgress: Math.round((processedCount / job.totalChunks) * 100),
      uploadedCount,
      processedCount,
    };
  },
});
