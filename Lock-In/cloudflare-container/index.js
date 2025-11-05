const express = require('express');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();

// Track active FFmpeg processes by timelapseId for cancellation
const activeProcesses = new Map(); // Map<timelapseId, { ffmpegProcess, inputPath, outputPath }>

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
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME;
const TMP_DIR = '/tmp';

// Download file from URL
async function downloadFromUrl(url) {
  console.log('Downloading video from URL:', url.substring(0, 100) + '...');

  const tmpPath = path.join(TMP_DIR, `input-${Date.now()}.mp4`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  fs.writeFileSync(tmpPath, Buffer.from(buffer));

  console.log('Video downloaded successfully to:', tmpPath);
  return tmpPath;
}

// Upload file to R2
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

// Process video with FFmpeg - True timelapse via frame sampling
async function processVideo(inputPath, outputPath, samplingFps, timelapseId = null) {
  return new Promise((resolve, reject) => {
    // Use fps filter for true timelapse effect (frame sampling)
    // Example: 60fps video with samplingFps=1 → captures 1 frame per second (60x compression)
    const ffmpeg = spawn('ffmpeg', [
      '-i', inputPath,
      '-filter:v', `fps=${samplingFps}`, // Frame sampling for true timelapse
      '-an', // Remove audio
      '-y', // Overwrite output file
      '-c:v', 'libx264', // Re-encode with h264
      '-preset', 'fast', // Fast encoding preset
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

// Main processing endpoint
app.post('/process', async (req, res) => {
  const { videoUrl, samplingFps = 1, timelapseId } = req.body;

  if (!videoUrl) {
    return res.status(400).json({ error: 'videoUrl is required' });
  }

  if (!timelapseId) {
    return res.status(400).json({ error: 'timelapseId is required' });
  }

  console.log(`Processing video from URL with sampling rate: ${samplingFps}fps for timelapse: ${timelapseId}`);

  let inputPath, outputPath;

  try {
    // Download video from URL
    console.log('Downloading video from URL...');
    inputPath = await downloadFromUrl(videoUrl);

    // Process video with frame sampling
    outputPath = path.join(TMP_DIR, `output-${Date.now()}.mp4`);
    console.log('Processing video with FFmpeg (frame sampling)...');
    await processVideo(inputPath, outputPath, samplingFps, timelapseId);

    // Read processed video as base64 for worker upload
    console.log('Reading processed video...');
    const videoBuffer = fs.readFileSync(outputPath);
    const videoBase64 = videoBuffer.toString('base64');

    // Cleanup temp files
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

    console.log('Successfully processed timelapse, returning to worker for R2 upload');

    res.json({
      success: true,
      videoBase64,
      samplingFps,
    });
  } catch (error) {
    console.error('Processing error:', error);

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

// Cancel processing endpoint
app.delete('/process/:timelapseId', (req, res) => {
  const { timelapseId } = req.params;

  console.log(`Received cancellation request for timelapse: ${timelapseId}`);

  const processInfo = activeProcesses.get(timelapseId);

  if (!processInfo) {
    console.log(`No active process found for timelapse: ${timelapseId}`);
    return res.status(404).json({
      success: false,
      error: 'No active process found for this timelapse'
    });
  }

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

    // Remove from active processes
    activeProcesses.delete(timelapseId);

    console.log(`Successfully cancelled processing for timelapse: ${timelapseId}`);

    res.json({
      success: true,
      message: 'Processing cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling process:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', ffmpeg: 'available' });
});

const PORT = process.env.PORT || 8080;
// Listen on 0.0.0.0 to accept connections from the Durable Object
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Video processing server running on port ${PORT} (listening on 0.0.0.0)`);
});
