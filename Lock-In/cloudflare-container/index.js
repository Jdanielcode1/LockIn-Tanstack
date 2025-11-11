const express = require('express');
const { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand, AbortMultipartUploadCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { spawn } = require('child_process');
const { pipeline } = require('stream/promises');
const { createWriteStream, createReadStream } = require('fs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();

// Track active FFmpeg processes by timelapseId for cancellation
const activeProcesses = new Map(); // Map<timelapseId, { ffmpegProcess, inputPath, outputPath }>
// Track active uploads for cancellation
const activeUploads = new Map(); // Map<timelapseId, { upload, uploadId, key }>

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

app.use(express.json());

// R2 Client configuration
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  // Add retry configuration for better reliability
  maxAttempts: 3,
  retryMode: 'adaptive',
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME;
const TMP_DIR = '/tmp';
const PROCESSING_SIZE_LIMIT = 500 * 1024 * 1024; // 500MB - max size for processing

// Calculate optimal part size based on file size
// R2 requirements: min 5MiB, max 5GiB per part, max 10,000 parts
// Strategy: Use larger parts for bigger files to reduce operation count and cost
function calculateOptimalPartSize(fileSizeBytes) {
  const fileSizeMB = fileSizeBytes / 1024 / 1024;
  
  // For very small files, use simple upload (handled separately)
  if (fileSizeMB < 5) {
    return null; // Use simple upload
  }
  
  // For small-medium files (5-100MB): use 10MB parts
  if (fileSizeMB <= 100) {
    return 10 * 1024 * 1024; // 10MB
  }
  
  // For medium-large files (100-500MB): use 25MB parts
  if (fileSizeMB <= 500) {
    return 25 * 1024 * 1024; // 25MB
  }
  
  // For large files (500MB-5GB): use 50MB parts
  if (fileSizeMB <= 5000) {
    return 50 * 1024 * 1024; // 50MB
  }
  
  // For very large files (5GB+): use 100MB parts (max recommended by rclone docs)
  // This minimizes operation count while staying well below 5GiB limit
  return 100 * 1024 * 1024; // 100MB
}

// Calculate optimal queue size based on file size and part size
function calculateOptimalQueueSize(fileSizeBytes, partSize) {
  if (!partSize) return 1; // Simple upload
  
  const numParts = Math.ceil(fileSizeBytes / partSize);
  
  // For small files with few parts, use fewer concurrent uploads
  if (numParts <= 4) {
    return 2;
  }
  
  // For medium files, use moderate concurrency
  if (numParts <= 20) {
    return 4;
  }
  
  // For large files, use higher concurrency (but cap at 8 to avoid overwhelming)
  return Math.min(8, Math.ceil(numParts / 10));
}

// Download file from URL (streaming - no memory buffer)
async function downloadFromUrl(url) {
  console.log('Downloading video from URL (streaming):', url.substring(0, 100) + '...');

  const tmpPath = path.join(TMP_DIR, `input-${Date.now()}.mp4`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.statusText}`);
  }

  // Convert Web Stream to Node.js stream and pipe to file
  const { Readable } = require('stream');
  const nodeStream = Readable.fromWeb(response.body);
  const fileStream = createWriteStream(tmpPath);

  await pipeline(nodeStream, fileStream);

  console.log('Video downloaded successfully to:', tmpPath);
  return tmpPath;
}

// Upload file to R2 (simple upload for small files)
async function uploadToR2(filePath, prefix = 'videos') {
  const fileContent = fs.readFileSync(filePath);
  const key = `${prefix}/${crypto.randomUUID()}.mp4`;

  console.log(`Uploading to R2: ${key} (${fileContent.length} bytes)`);

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileContent,
    ContentType: 'video/mp4',
  });

  await s3Client.send(command);
  console.log(`Successfully uploaded to R2: ${key}`);
  return key;
}

// Upload thumbnail to R2 (always uses simple upload - thumbnails are small)
async function uploadThumbnailToR2(filePath) {
  const fileContent = fs.readFileSync(filePath);
  const key = `thumbnails/${crypto.randomUUID()}.jpg`;

  console.log(`📸 Uploading thumbnail to R2: ${key} (${(fileContent.length / 1024).toFixed(2)}KB)`);

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileContent,
    ContentType: 'image/jpeg',
  });

  await s3Client.send(command);
  console.log(`✅ Thumbnail uploaded successfully: ${key}`);
  return key;
}

// Improved upload video to R2 using multipart streaming with optimizations
async function uploadVideoToR2(filePath, prefix = 'timelapses', timelapseId = null, progressCallback = null) {
  const key = `${prefix}/${crypto.randomUUID()}.mp4`;

  // 🔍 Phase 1: Comprehensive file verification before upload
  console.log('🔍 [Upload Debug] Pre-upload file verification:', {
    filePath,
    exists: fs.existsSync(filePath),
    timelapseId: timelapseId || 'unknown',
  });

  if (!fs.existsSync(filePath)) {
    throw new Error(`File does not exist at path: ${filePath}`);
  }

  const fileStats = fs.statSync(filePath);
  const fileSizeMB = fileStats.size / 1024 / 1024;

  console.log('🔍 [Upload Debug] File stats:', {
    path: filePath,
    size: fileStats.size,
    sizeMB: fileSizeMB.toFixed(2),
    sizeKB: (fileStats.size / 1024).toFixed(2),
    isFile: fileStats.isFile(),
    mode: fileStats.mode.toString(8),
  });

  // Verify file is not empty
  if (fileStats.size === 0) {
    throw new Error('Cannot upload empty file');
  }

  // Read first few bytes to verify file is readable
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(Math.min(1024, fileStats.size));
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
    fs.closeSync(fd);

    console.log('🔍 [Upload Debug] File is readable:', {
      bytesRead,
      firstBytesHex: buffer.slice(0, 8).toString('hex'),
    });
  } catch (err) {
    throw new Error(`File exists but cannot be read: ${err.message}`);
  }

  console.log(`Uploading to R2: ${key} (${fileSizeMB.toFixed(2)}MB, ${fileStats.size} bytes)`);

  // Calculate optimal part size
  const partSize = calculateOptimalPartSize(fileStats.size);
  
  // For files < 5MB, use simple upload (more reliable for small files)
  if (!partSize || fileStats.size < 5 * 1024 * 1024) {
    console.log('🔍 [Upload Debug] Using simple upload (file < 5MB)');

    const fileContent = fs.readFileSync(filePath);
    console.log('🔍 [Upload Debug] File content loaded:', {
      bufferLength: fileContent.length,
      expectedSize: fileStats.size,
      match: fileContent.length === fileStats.size,
    });

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileContent,
      ContentType: 'video/mp4',
      // Add metadata for tracking
      Metadata: {
        'timelapse-id': timelapseId || 'unknown',
        'upload-method': 'simple',
        'file-size': fileStats.size.toString(),
      },
    });

    await s3Client.send(command);
    console.log(`✅ Upload command sent to R2 (simple): ${key}`);

    // 🔍 Phase 1: Verify upload with HEAD request
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });
      const headResult = await s3Client.send(headCommand);

      console.log('🔍 [Upload Debug] Post-upload verification (HEAD):', {
        key,
        contentLength: headResult.ContentLength,
        expectedSize: fileStats.size,
        match: headResult.ContentLength === fileStats.size,
        contentType: headResult.ContentType,
        metadata: headResult.Metadata,
      });

      if (headResult.ContentLength !== fileStats.size) {
        throw new Error(`Upload verification failed: Expected ${fileStats.size} bytes but R2 has ${headResult.ContentLength} bytes`);
      }
    } catch (verifyErr) {
      console.error('❌ [Upload Debug] Verification failed:', verifyErr);
      throw new Error(`Upload completed but verification failed: ${verifyErr.message}`);
    }

    console.log(`✅ Successfully uploaded and verified to R2 (simple): ${key}`);
    return key;
  }

  // For larger files, use multipart streaming
  const queueSize = calculateOptimalQueueSize(fileStats.size, partSize);
  const numParts = Math.ceil(fileStats.size / partSize);
  
  console.log(`Using multipart streaming upload:`);
  console.log(`  - Part size: ${(partSize / 1024 / 1024).toFixed(2)}MB`);
  console.log(`  - Queue size: ${queueSize} concurrent parts`);
  console.log(`  - Estimated parts: ${numParts}`);
  
  // Warn if approaching part limit
  if (numParts > 9000) {
    console.warn(`Warning: File will create ${numParts} parts, approaching 10,000 part limit`);
  }

  const fileStream = createReadStream(filePath);

  // Handle stream errors
  fileStream.on('error', (err) => {
    console.error('File stream error:', err);
    // Clean up active upload tracking
    if (timelapseId) {
      activeUploads.delete(timelapseId);
    }
    throw err;
  });

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileStream,
      ContentType: 'video/mp4',
      // Add metadata for tracking
      Metadata: {
        'timelapse-id': timelapseId || 'unknown',
        'upload-method': 'multipart',
        'file-size': fileStats.size.toString(),
        'part-size': partSize.toString(),
      },
    },
    partSize: partSize,
    queueSize: queueSize,
    // Add leavePartsOnError to false so failed uploads are cleaned up
    leavePartsOnError: false,
  });

  // Track upload for cancellation
  if (timelapseId) {
    activeUploads.set(timelapseId, { upload, uploadId: null, key });
  }

  // Enhanced progress tracking
  let lastProgressPercent = 0;
  upload.on('httpUploadProgress', (progress) => {
    if (progress.loaded && progress.total) {
      const percentage = Math.round((progress.loaded / progress.total) * 100);
      const loadedMB = (progress.loaded / 1024 / 1024).toFixed(2);
      const totalMB = (progress.total / 1024 / 1024).toFixed(2);
      
      // Log progress every 10% or on completion
      if (percentage >= lastProgressPercent + 10 || percentage === 100) {
        console.log(`Upload progress: ${percentage}% (${loadedMB}MB / ${totalMB}MB)`);
        lastProgressPercent = percentage;
      }
      
      // Call progress callback if provided
      if (progressCallback && typeof progressCallback === 'function') {
        progressCallback({
          percentage,
          loaded: progress.loaded,
          total: progress.total,
          loadedMB: parseFloat(loadedMB),
          totalMB: parseFloat(totalMB),
        });
      }
    }
  });

  try {
    // Store uploadId when available (for cancellation)
    upload.on('httpRequest', (request) => {
      if (timelapseId && request.headers && request.headers['x-amz-upload-id']) {
        const uploadInfo = activeUploads.get(timelapseId);
        if (uploadInfo) {
          uploadInfo.uploadId = request.headers['x-amz-upload-id'];
        }
      }
    });

    await upload.done();
    console.log(`✅ Multipart upload completed: ${key}`);

    // 🔍 Phase 1: Verify multipart upload with HEAD request
    try {
      const headCommand = new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      });
      const headResult = await s3Client.send(headCommand);

      console.log('🔍 [Upload Debug] Post-upload verification (HEAD - multipart):', {
        key,
        contentLength: headResult.ContentLength,
        expectedSize: fileStats.size,
        match: headResult.ContentLength === fileStats.size,
        contentType: headResult.ContentType,
        uploadMethod: headResult.Metadata?.['upload-method'],
      });

      if (headResult.ContentLength !== fileStats.size) {
        throw new Error(`Upload verification failed: Expected ${fileStats.size} bytes but R2 has ${headResult.ContentLength} bytes`);
      }
    } catch (verifyErr) {
      console.error('❌ [Upload Debug] Multipart verification failed:', verifyErr);
      throw new Error(`Upload completed but verification failed: ${verifyErr.message}`);
    }

    // Clean up tracking
    if (timelapseId) {
      activeUploads.delete(timelapseId);
    }

    console.log(`✅ Successfully uploaded and verified to R2 (multipart): ${key}`);
    return key;
  } catch (err) {
    console.error('Upload failed:', err);
    
    // Clean up tracking
    if (timelapseId) {
      activeUploads.delete(timelapseId);
    }
    
    // Attempt to abort multipart upload if it exists
    try {
      if (upload && upload.uploadId) {
        console.log('Attempting to abort multipart upload...');
        await s3Client.send(new AbortMultipartUploadCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          UploadId: upload.uploadId,
        }));
        console.log('Multipart upload aborted successfully');
      }
    } catch (abortErr) {
      console.error('Failed to abort multipart upload:', abortErr);
    }
    
    throw err;
  }
}

// Get video metadata using FFprobe
async function getVideoMetadata(inputPath) {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=r_frame_rate,width,height:format=duration',
      '-of', 'json',
      inputPath
    ]);

    let output = '';
    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code === 0) {
        try {
          const data = JSON.parse(output);
          const duration = parseFloat(data.format.duration);
          const fpsStr = data.streams[0].r_frame_rate;
          const [num, den] = fpsStr.split('/').map(Number);
          const fps = num / den;
          const width = data.streams[0].width;
          const height = data.streams[0].height;

          resolve({ duration, fps, width, height });
        } catch (err) {
          reject(new Error(`Failed to parse ffprobe output: ${err.message}`));
        }
      } else {
        reject(new Error(`ffprobe exited with code ${code}`));
      }
    });

    ffprobe.on('error', reject);
  });
}

// Calculate optimal sampling rate based on video duration (matching iOS behavior)
function calculateSamplingRate(durationMinutes) {
  // iOS sampling schedule:
  // 0-10 min: 2 fps → 15x speed
  // 10-20 min: 1 fps → 30x speed
  // 20-80 min: 0.5 fps → 60x speed
  // 80+ min: 0.033 fps (1 frame/30s) → 900x speed

  if (durationMinutes <= 10) {
    return { samplingFps: 2, speedMultiplier: 15 };
  } else if (durationMinutes <= 20) {
    return { samplingFps: 1, speedMultiplier: 30 };
  } else if (durationMinutes <= 80) {
    return { samplingFps: 0.5, speedMultiplier: 60 };
  } else {
    return { samplingFps: 0.033, speedMultiplier: 900 }; // 1 frame per 30 seconds
  }
}

// Calculate expected output duration
function calculateOutputDuration(inputDurationSeconds, samplingFps) {
  // Frames captured = duration * samplingFps
  // Output duration = frames / 30 fps playback
  const framesCaptured = inputDurationSeconds * samplingFps;
  const outputDuration = framesCaptured / 30;
  return Math.round(outputDuration);
}

// Process video with FFmpeg - True timelapse via frame sampling with 30fps playback
async function processVideo(inputPath, outputPath, samplingFps, timelapseId = null, progressCallback = null) {
  return new Promise((resolve, reject) => {
    // TRUE TIMELAPSE: Sample at low fps, play at 30 fps
    // Example: fps=2 (capture 2 frames/sec) + setpts for 30fps playback = 15x speed
    const ffmpeg = spawn('ffmpeg', [
      '-i', inputPath,
      '-vf', `fps=${samplingFps},setpts=N/(30*TB),scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2`, // Sample + set timing for 30fps + scale
      '-r', '30', // Output framerate
      '-an', // Remove audio
      '-c:v', 'libx264', // H264 codec
      '-crf', '23', // Quality control
      '-preset', 'ultrafast', // Fast encoding
      '-movflags', '+faststart', // Web optimized
      '-y', // Overwrite output file
      outputPath
    ]);

    // Track this process if timelapseId provided
    if (timelapseId) {
      activeProcesses.set(timelapseId, { ffmpegProcess: ffmpeg, inputPath, outputPath });
      console.log(`Tracking FFmpeg process for timelapse: ${timelapseId}`);
    }

    let stderr = '';
    let wasKilled = false;

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log('FFmpeg:', data.toString());
    });

    ffmpeg.on('close', (code) => {
      // Remove from tracking
      if (timelapseId) {
        activeProcesses.delete(timelapseId);
      }

      if (wasKilled) {
        reject(new Error('FFmpeg process was cancelled'));
      } else if (code === 0) {
        console.log('FFmpeg processing completed successfully');
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
      }
    });

    ffmpeg.on('error', (err) => {
      // Remove from tracking
      if (timelapseId) {
        activeProcesses.delete(timelapseId);
      }
      reject(err);
    });

    // Store a flag to mark if killed
    ffmpeg.wasKilled = false;
    ffmpeg.on('SIGTERM', () => { wasKilled = true; });
    ffmpeg.on('SIGKILL', () => { wasKilled = true; });
  });
}

// Extract single thumbnail from video (for timelapse preview)
async function extractThumbnail(inputPath, timestamp = 0.5) {
  console.log(`Extracting thumbnail at ${timestamp * 100}% of video`);

  const outputPath = path.join(TMP_DIR, `thumbnail-${Date.now()}.jpg`);

  return new Promise((resolve, reject) => {
    // First, get video duration to calculate exact timestamp
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      inputPath
    ]);

    let durationOutput = '';
    ffprobe.stdout.on('data', (data) => {
      durationOutput += data.toString();
    });

    ffprobe.on('close', async (code) => {
      if (code !== 0) {
        return reject(new Error(`ffprobe failed with code ${code}`));
      }

      const duration = parseFloat(durationOutput.trim());
      const timeInSeconds = duration * timestamp;

      console.log(`Video duration: ${duration}s, extracting frame at ${timeInSeconds.toFixed(2)}s`);

      // Extract the frame
      const ffmpeg = spawn('ffmpeg', [
        '-ss', timeInSeconds.toString(),
        '-i', inputPath,
        '-vframes', '1',
        '-vf', 'scale=640:-1', // Scale to 640px width, maintain aspect ratio
        '-q:v', '2', // High quality JPEG
        '-y',
        outputPath
      ]);

      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ Thumbnail extracted successfully: ${outputPath}`);
          resolve(outputPath);
        } else {
          reject(new Error(`FFmpeg thumbnail extraction failed: ${stderr}`));
        }
      });

      ffmpeg.on('error', reject);
    });

    ffprobe.on('error', reject);
  });
}

// Extract frames from video at different timestamps
async function extractFrames(inputPath, timestamps = [0.25, 0.5, 0.75]) {
  console.log('Extracting frames at timestamps:', timestamps);

  // First, get video duration
  const duration = await new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      inputPath
    ]);

    let output = '';
    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code === 0) {
        resolve(parseFloat(output.trim()));
      } else {
        reject(new Error(`ffprobe exited with code ${code}`));
      }
    });

    ffprobe.on('error', reject);
  });

  console.log('Video duration:', duration, 'seconds');

  // Extract frames at specified timestamps
  const frames = [];

  for (const timestamp of timestamps) {
    const timeInSeconds = duration * timestamp;
    const outputPath = path.join(TMP_DIR, `frame-${Date.now()}-${timestamp}.jpg`);

    await new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-ss', timeInSeconds.toString(),
        '-i', inputPath,
        '-vframes', '1',
        '-q:v', '2', // High quality JPEG
        '-y',
        outputPath
      ]);

      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log(`Extracted frame at ${timestamp * 100}%`);
          resolve();
        } else {
          reject(new Error(`FFmpeg frame extraction failed: ${stderr}`));
        }
      });

      ffmpeg.on('error', reject);
    });

    // Read frame as base64
    const frameBuffer = fs.readFileSync(outputPath);
    const base64 = frameBuffer.toString('base64');

    frames.push({
      timestamp,
      base64,
      path: outputPath
    });
  }

  return frames;
}

// Call Convex HTTP action to update processing status
async function updateConvexStatus(timelapseId, status, processedVideoKey = null, error = null) {
  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) {
    console.warn('CONVEX_URL not set, skipping status update');
    return;
  }

  try {
    const payload = {
      timelapseId,
      status,
      ...(processedVideoKey && { processedVideoKey }),
      ...(error && { error }),
    };

    console.log('Updating Convex with:', JSON.stringify(payload));

    const response = await fetch(`${convexUrl}/updateProcessingStatus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to update Convex:', response.status, errorText);
    } else {
      const result = await response.json();
      console.log('Successfully updated Convex status to:', status, result);
    }
  } catch (err) {
    console.error('Error calling Convex:', err);
  }
}

// Call Convex HTTP action to update thumbnail
async function updateConvexThumbnail(timelapseId, thumbnailKey) {
  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) {
    console.warn('CONVEX_URL not set, skipping thumbnail update');
    return;
  }

  try {
    console.log(`📸 Updating Convex with thumbnail: ${thumbnailKey}`);

    const response = await fetch(`${convexUrl}/updateThumbnail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timelapseId,
        thumbnailKey,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to update thumbnail in Convex:', response.status, errorText);
    } else {
      const result = await response.json();
      console.log('✅ Successfully updated thumbnail in Convex:', result);
    }
  } catch (err) {
    console.error('Error calling Convex for thumbnail update:', err);
  }
}

// Main processing endpoint
app.post('/process', async (req, res) => {
  const { videoUrl, timelapseId } = req.body;

  if (!videoUrl) {
    return res.status(400).json({ error: 'videoUrl is required' });
  }

  if (!timelapseId) {
    return res.status(400).json({ error: 'timelapseId is required' });
  }

  console.log(`Processing video with intelligent timelapse for: ${timelapseId}`);

  let inputPath, outputPath;

  try {
    // 🔄 Phase 2: Update status to processing
    await updateConvexStatus(timelapseId, 'processing');

    // Check file size before processing
    console.log('Checking video size...');
    const headResponse = await fetch(videoUrl, { method: 'HEAD' });
    const contentLength = parseInt(headResponse.headers.get('content-length') || '0');

    if (contentLength > PROCESSING_SIZE_LIMIT) {
      const sizeMB = Math.round(contentLength / 1024 / 1024);
      const limitMB = Math.round(PROCESSING_SIZE_LIMIT / 1024 / 1024);
      console.log(`Video too large: ${sizeMB}MB exceeds ${limitMB}MB limit`);
      return res.status(413).json({
        error: `Video too large for processing: ${sizeMB}MB exceeds ${limitMB}MB limit. Please use "This is already a timelapse" option or compress your video first.`,
        sizeMB,
        limitMB
      });
    }

    console.log(`Video size OK: ${Math.round(contentLength / 1024 / 1024)}MB`);

    // Download video from URL
    console.log('Downloading video from URL...');
    inputPath = await downloadFromUrl(videoUrl);

    // Get video metadata
    console.log('Analyzing video metadata...');
    const metadata = await getVideoMetadata(inputPath);
    const durationMinutes = metadata.duration / 60;

    console.log(`Video metadata: ${Math.round(durationMinutes)} minutes, ${metadata.fps.toFixed(2)} fps, ${metadata.width}x${metadata.height}`);

    // Calculate optimal sampling rate based on duration
    const { samplingFps, speedMultiplier } = calculateSamplingRate(durationMinutes);
    const estimatedOutputDuration = calculateOutputDuration(metadata.duration, samplingFps);

    console.log(`Using sampling rate: ${samplingFps} fps (${speedMultiplier}x speed)`);
    console.log(`Estimated output: ${estimatedOutputDuration} seconds`);

    // Process video with frame sampling
    outputPath = path.join(TMP_DIR, `output-${Date.now()}.mp4`);
    console.log('Processing video with FFmpeg (true timelapse)...');
    await processVideo(inputPath, outputPath, samplingFps, timelapseId);

    // Verify output file exists and has content
    if (!fs.existsSync(outputPath)) {
      throw new Error('FFmpeg completed but output file does not exist');
    }

    const outputStats = fs.statSync(outputPath);
    console.log(`FFmpeg output file size: ${outputStats.size} bytes (${(outputStats.size / 1024 / 1024).toFixed(2)}MB)`);

    if (outputStats.size === 0) {
      throw new Error('FFmpeg completed but output file is empty');
    }

    if (outputStats.size < 1024) {
      console.warn(`Warning: Output file is very small (${outputStats.size} bytes), may be corrupted`);
    }

    // 🎬 Phase 3: Extract thumbnail from processed video
    let thumbnailPath = null;
    let thumbnailKey = null;
    try {
      console.log('📸 Extracting thumbnail from processed video...');
      thumbnailPath = await extractThumbnail(outputPath, 0.5); // Extract at 50% of video

      // Upload thumbnail to R2
      console.log('📸 Uploading thumbnail to R2...');
      thumbnailKey = await uploadThumbnailToR2(thumbnailPath);

      // Update Convex with thumbnail key
      await updateConvexThumbnail(timelapseId, thumbnailKey);

      console.log(`✅ Thumbnail extracted and uploaded: ${thumbnailKey}`);
    } catch (thumbnailError) {
      console.error('⚠️ Thumbnail extraction failed (non-fatal):', thumbnailError);
      // Don't fail the whole process if thumbnail fails
    } finally {
      // Clean up thumbnail file
      if (thumbnailPath && fs.existsSync(thumbnailPath)) {
        fs.unlinkSync(thumbnailPath);
      }
    }

    // Stream upload to R2 with improved multipart upload
    console.log('Streaming processed video to R2...');
    const processedVideoKey = await uploadVideoToR2(outputPath, 'timelapses', timelapseId);

    // 🔄 Phase 2: Update status to complete with processed video key
    await updateConvexStatus(timelapseId, 'complete', processedVideoKey);

    // Cleanup temp files
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

    console.log('✅ Successfully processed timelapse and uploaded to R2');

    res.json({
      success: true,
      processedVideoKey,
      samplingFps,
      speedMultiplier,
      estimatedOutputDuration,
      sourceMetadata: {
        duration: metadata.duration,
        fps: metadata.fps,
        width: metadata.width,
        height: metadata.height
      }
    });
  } catch (error) {
    console.error('❌ Processing error:', error);

    // 🔄 Phase 2: Update status to failed with error message
    await updateConvexStatus(timelapseId, 'failed', null, error.message);

    // Cleanup on error
    if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Extract frames endpoint for AI thumbnail generation
app.post('/extract-frames', async (req, res) => {
  const { videoUrl } = req.body;

  if (!videoUrl) {
    return res.status(400).json({ error: 'videoUrl is required' });
  }

  console.log(`Extracting frames from video URL`);

  let inputPath;
  const framePaths = [];

  try {
    // Download video from URL
    console.log('Downloading video from URL...');
    inputPath = await downloadFromUrl(videoUrl);

    // Extract frames at 25%, 50%, 75%
    const frames = await extractFrames(inputPath, [0.25, 0.5, 0.75]);

    // Keep track of paths for cleanup
    frames.forEach(f => framePaths.push(f.path));

    // Cleanup input video
    fs.unlinkSync(inputPath);

    res.json({
      success: true,
      frames: frames.map(f => ({
        timestamp: f.timestamp,
        base64: f.base64
      }))
    });

    // Cleanup frame files after response is sent
    framePaths.forEach(p => {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });
  } catch (error) {
    console.error('Frame extraction error:', error);

    // Cleanup on error
    if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    framePaths.forEach(p => {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Cancel processing endpoint (enhanced to also cancel uploads)
app.delete('/process/:timelapseId', async (req, res) => {
  const { timelapseId } = req.params;

  console.log(`Received cancellation request for timelapse: ${timelapseId}`);

  const processInfo = activeProcesses.get(timelapseId);
  const uploadInfo = activeUploads.get(timelapseId);

  // Cancel FFmpeg process if running
  if (processInfo) {
    const { ffmpegProcess, inputPath, outputPath } = processInfo;

    try {
      // Kill the FFmpeg process
      console.log(`Killing FFmpeg process (PID: ${ffmpegProcess.pid})...`);
      ffmpegProcess.kill('SIGTERM');

      // Give it a moment, then force kill if needed
      setTimeout(() => {
        if (!ffmpegProcess.killed) {
          console.log('Process did not terminate, force killing...');
          ffmpegProcess.kill('SIGKILL');
        }
      }, 2000);

      // Cleanup temp files
      try {
        if (inputPath && fs.existsSync(inputPath)) {
          fs.unlinkSync(inputPath);
          console.log(`Cleaned up input file: ${inputPath}`);
        }
        if (outputPath && fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
          console.log(`Cleaned up output file: ${outputPath}`);
        }
      } catch (cleanupError) {
        console.error('Error cleaning up files:', cleanupError);
      }

      // Remove from tracking
      activeProcesses.delete(timelapseId);
    } catch (error) {
      console.error('Error cancelling FFmpeg process:', error);
    }
  }

  // Cancel upload if running
  if (uploadInfo) {
    const { upload, uploadId, key } = uploadInfo;

    try {
      console.log(`Aborting multipart upload for key: ${key}`);
      
      // Abort the upload
      if (upload && uploadId) {
        await s3Client.send(new AbortMultipartUploadCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          UploadId: uploadId,
        }));
        console.log('Multipart upload aborted successfully');
      } else if (upload) {
        // Try to abort via upload object
        await upload.abort();
        console.log('Multipart upload aborted via upload object');
      }
      
      // Remove from tracking
      activeUploads.delete(timelapseId);
    } catch (error) {
      console.error('Error aborting upload:', error);
    }
  }

  if (!processInfo && !uploadInfo) {
    console.log(`No active process or upload found for timelapse: ${timelapseId}`);
    return res.status(404).json({
      success: false,
      error: 'No active process or upload found for this timelapse'
    });
  }

  console.log(`Successfully cancelled processing for timelapse: ${timelapseId}`);

  res.json({
    success: true,
    message: 'Processing cancelled successfully'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    ffmpeg: 'available',
    activeProcesses: activeProcesses.size,
    activeUploads: activeUploads.size,
  });
});

const PORT = process.env.PORT || 8080;
// Listen on 0.0.0.0 to accept connections from the Durable Object
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Video processing server running on port ${PORT} (listening on 0.0.0.0)`);
});

