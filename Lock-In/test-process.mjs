#!/usr/bin/env node

const WORKER_URL = 'https://video-processor-container.josedaniel-cantu.workers.dev';

// Use a video key from the recent logs
const videoKey = '07d72ce0-873e-4d90-46e6-4120957e4825'; // From the Convex logs
const timelapseId = `k${Date.now().toString(36)}${Math.random().toString(36).substr(2, 15)}`;

async function testProcessing() {
  console.log('🎬 Testing video processing pipeline...\n');
  console.log('📹 Video Key:', videoKey);
  console.log('🆔 Timelapse ID:', timelapseId);
  console.log('🔗 Worker URL:', WORKER_URL);
  console.log('');

  console.log('⚙️  Triggering video processing...\n');

  const processResponse = await fetch(`${WORKER_URL}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      videoKey: videoKey,
      timelapseId: timelapseId
    })
  });

  console.log(`📊 Response status: ${processResponse.status}\n`);

  const responseText = await processResponse.text();

  if (!processResponse.ok) {
    console.error(`❌ Processing failed:\n${responseText}\n`);
    throw new Error(`Processing failed: ${processResponse.status}`);
  }

  let processResult;
  try {
    processResult = JSON.parse(responseText);
  } catch {
    processResult = responseText;
  }

  console.log('✅ Processing triggered successfully!\n');
  console.log('📋 Result:', JSON.stringify(processResult, null, 2));
  console.log('\n🎉 Test complete! Check wrangler tail for detailed processing logs.');
  console.log('   Watch for:');
  console.log('   🔍 [Upload Debug] File verification');
  console.log('   📸 Thumbnail extraction');
  console.log('   ✅ Upload verification');
  console.log('   🔄 Status updates');
}

testProcessing().catch(error => {
  console.error('\n❌ Test failed:', error.message);
  process.exit(1);
});
