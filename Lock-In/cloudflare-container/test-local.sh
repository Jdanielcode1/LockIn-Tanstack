#!/bin/bash

# Test script for local Docker container
# Run this before deploying to Cloudflare

echo "🚀 Starting video-processor container..."
echo ""

# Check if environment variables are set
if [ -z "$R2_ENDPOINT" ] || [ -z "$R2_ACCESS_KEY_ID" ] || [ -z "$R2_SECRET_ACCESS_KEY" ] || [ -z "$R2_BUCKET" ]; then
    echo "❌ Error: R2 environment variables not set!"
    echo ""
    echo "Set them first:"
    echo "  export R2_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com"
    echo "  export R2_ACCESS_KEY_ID=your_access_key"
    echo "  export R2_SECRET_ACCESS_KEY=your_secret_key"
    echo "  export R2_BUCKET=your_bucket_name"
    echo ""
    exit 1
fi

echo "✅ Environment variables set"
echo "   Endpoint: $R2_ENDPOINT"
echo "   Bucket: $R2_BUCKET"
echo ""

# Run container
docker run -d \
  -p 8080:8080 \
  -e R2_ENDPOINT="$R2_ENDPOINT" \
  -e R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  -e R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  -e R2_BUCKET="$R2_BUCKET" \
  --name video-processor-test \
  video-processor

echo "⏳ Waiting for container to start..."
sleep 3

# Test health endpoint
echo ""
echo "🏥 Testing health endpoint..."
HEALTH=$(curl -s http://localhost:8080/health)
echo "Response: $HEALTH"

if [[ $HEALTH == *"healthy"* ]]; then
    echo ""
    echo "✅ Container is running and healthy!"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Test processing: curl -X POST http://localhost:8080/process \\"
    echo "        -H 'Content-Type: application/json' \\"
    echo "        -d '{\"videoKey\":\"videos/your-test-video.mp4\",\"speedMultiplier\":8}'"
    echo ""
    echo "   2. View logs: docker logs video-processor-test"
    echo "   3. Stop container: docker stop video-processor-test && docker rm video-processor-test"
else
    echo ""
    echo "❌ Container started but health check failed"
    echo "   Check logs: docker logs video-processor-test"
fi
