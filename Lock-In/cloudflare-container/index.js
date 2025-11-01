const express = require('express');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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
  const key = `${prefix}/${crypto.randomUUID()}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileContent,
    ContentType: 'video/mp4',
  });

  await s3Client.send(command);
  return key;
}

// Process video with FFmpeg
async function processVideo(inputPath, outputPath, speedMultiplier) {
  return new Promise((resolve, reject) => {
    // Use setpts to change timestamps and fps filter to output at proper frame rate
    const ffmpeg = spawn('ffmpeg', [
      '-i', inputPath,
      '-filter:v', `setpts=PTS/${speedMultiplier},fps=30`,
      '-an', // Remove audio
      '-y', // Overwrite output file
      '-c:v', 'libx264', // Re-encode with h264
      '-preset', 'fast', // Fast encoding preset
      outputPath
    ]);

    let stderr = '';

    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log('FFmpeg:', data.toString());
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        console.log('FFmpeg processing completed successfully');
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(err);
    });
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
  const { videoUrl, speedMultiplier = 8, timelapseId } = req.body;

  if (!videoUrl) {
    return res.status(400).json({ error: 'videoUrl is required' });
  }

  if (!timelapseId) {
    return res.status(400).json({ error: 'timelapseId is required' });
  }

  console.log(`Processing video from URL with speed: ${speedMultiplier}x for timelapse: ${timelapseId}`);

  let inputPath, outputPath;

  try {
    // Download video from URL
    console.log('Downloading video from URL...');
    inputPath = await downloadFromUrl(videoUrl);

    // Process video
    outputPath = path.join(TMP_DIR, `output-${Date.now()}.mp4`);
    console.log('Processing video with FFmpeg...');
    await processVideo(inputPath, outputPath, speedMultiplier);

    // Read processed video and return as base64
    console.log('Reading processed video...');
    const processedVideoBuffer = fs.readFileSync(outputPath);
    const processedVideoBase64 = processedVideoBuffer.toString('base64');

    // Cleanup temp files
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

    console.log('Sending processed video back to worker');

    res.json({
      success: true,
      videoBase64: processedVideoBase64,
      speedMultiplier,
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', ffmpeg: 'available' });
});

const PORT = process.env.PORT || 8080;
// Listen on 0.0.0.0 to accept connections from the Durable Object
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Video processing server running on port ${PORT} (listening on 0.0.0.0)`);
});
