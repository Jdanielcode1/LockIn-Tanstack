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

const BUCKET_NAME = process.env.R2_BUCKET;
const TMP_DIR = '/tmp';

// Download file from R2
async function downloadFromR2(key) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const response = await s3Client.send(command);
  const tmpPath = path.join(TMP_DIR, `input-${Date.now()}.mp4`);

  const stream = fs.createWriteStream(tmpPath);
  await new Promise((resolve, reject) => {
    response.Body.pipe(stream);
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

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
  const { videoKey, speedMultiplier = 8, timelapseId } = req.body;

  if (!videoKey) {
    return res.status(400).json({ error: 'videoKey is required' });
  }

  if (!timelapseId) {
    return res.status(400).json({ error: 'timelapseId is required' });
  }

  console.log(`Processing video: ${videoKey} with speed: ${speedMultiplier}x for timelapse: ${timelapseId}`);

  // Update status to "processing"
  await updateConvexStatus(timelapseId, 'processing');

  let inputPath, outputPath;

  try {
    // Download video from R2
    console.log('Downloading video from R2...');
    inputPath = await downloadFromR2(videoKey);

    // Process video
    outputPath = path.join(TMP_DIR, `output-${Date.now()}.mp4`);
    console.log('Processing video with FFmpeg...');
    await processVideo(inputPath, outputPath, speedMultiplier);

    // Upload processed video back to R2
    console.log('Uploading processed video to R2...');
    const processedKey = await uploadToR2(outputPath, 'timelapses');

    // Cleanup temp files
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

    // Update Convex with success
    await updateConvexStatus(timelapseId, 'complete', processedKey);

    res.json({
      success: true,
      processedVideoKey: processedKey,
      originalVideoKey: videoKey,
      speedMultiplier,
    });
  } catch (error) {
    console.error('Processing error:', error);

    // Cleanup on error
    if (inputPath && fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (outputPath && fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    // Update Convex with failure
    await updateConvexStatus(timelapseId, 'failed', null, error.message);

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
