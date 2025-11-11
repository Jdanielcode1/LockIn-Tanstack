#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONVEX_URL = 'https://scrupulous-hound-796.convex.cloud';
const WORKER_URL = 'https://video-processor-container.josedaniel-cantu.workers.dev';
const VIDEO_PATH = path.join(__dirname, 'test-videos/v12044gd0000c7pm6erc77ueg1k8h2b0.mp4');

async function testVideoUpload() {
  console.log('🎬 Starting video upload test...\n');

  // Step 1: Read the test video
  console.log('📹 Reading test video:', VIDEO_PATH);
  const videoBuffer = fs.readFileSync(VIDEO_PATH);
  const videoSize = videoBuffer.length;
  console.log(`   Size: ${(videoSize / 1024).toFixed(2)} KB (${videoSize} bytes)\n`);

  // Step 2: Get upload URL from Convex
  console.log('🔗 Getting upload URL from Convex...');
  const uploadUrlResponse = await fetch(`${CONVEX_URL}/api/r2/generateUploadUrl`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });

  if (!uploadUrlResponse.ok) {
    const errorText = await uploadUrlResponse.text();
    throw new Error(`Failed to get upload URL: ${uploadUrlResponse.status} ${errorText}`);
  }

  const { uploadUrl, key } = await uploadUrlResponse.json();
  console.log(`   ✓ Got upload URL for key: ${key}\n`);

  // Step 3: Upload video to R2
  console.log('☁️  Uploading video to R2...');
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    body: videoBuffer,
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': videoSize.toString()
    }
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Failed to upload video: ${uploadResponse.status} ${errorText}`);
  }

  console.log('   ✓ Video uploaded successfully\n');

  // Step 4: Sync metadata with Convex
  console.log('🔄 Syncing metadata with Convex...');
  const syncResponse = await fetch(`${CONVEX_URL}/api/r2/syncMetadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key })
  });

  if (!syncResponse.ok) {
    const errorText = await syncResponse.text();
    console.warn(`   ⚠️  Metadata sync failed: ${syncResponse.status} ${errorText}`);
  } else {
    console.log('   ✓ Metadata synced\n');
  }

  // Step 5: Create timelapse record (we need a project first)
  // For testing, we'll use an existing project ID from the logs
  const projectId = 'jn724qz51fyfqbz2b18gg3c7a57v48f3'; // From earlier logs
  const timelapseId = `k${Date.now().toString(36)}${Math.random().toString(36).substr(2, 9)}`; // Generate ID

  console.log('📝 Creating timelapse record...');
  console.log(`   Project ID: ${projectId}`);
  console.log(`   Timelapse ID: ${timelapseId}`);
  console.log(`   Video Key: ${key}\n`);

  // Step 6: Trigger processing
  console.log('⚙️  Triggering video processing...');
  console.log(`   Worker URL: ${WORKER_URL}/process\n`);

  const processResponse = await fetch(`${WORKER_URL}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      videoKey: key,
      timelapseId: timelapseId
    })
  });

  console.log(`   Response status: ${processResponse.status}`);

  if (!processResponse.ok) {
    const errorText = await processResponse.text();
    console.error(`   ❌ Processing failed: ${errorText}\n`);
    throw new Error(`Processing failed: ${processResponse.status}`);
  }

  const processResult = await processResponse.json();
  console.log('   ✅ Processing started successfully!\n');
  console.log('📊 Result:', JSON.stringify(processResult, null, 2));

  console.log('\n🎉 Test complete! Check the wrangler tail logs for detailed processing info.');
}

// Run the test
testVideoUpload().catch(error => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
