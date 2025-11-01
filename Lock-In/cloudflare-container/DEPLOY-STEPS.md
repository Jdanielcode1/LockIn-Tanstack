# Step-by-Step Deployment Guide

This is a simplified guide to deploy your video processing container to Cloudflare.

## What You Need

✅ Cloudflare account with **Workers Paid plan** ($5/month)
✅ Docker running locally (`docker info` should work)
✅ Your existing R2 bucket (the one you're already using for Lock-In)
✅ R2 credentials (you should already have these)

## Step 1: Install Wrangler

```bash
cd cloudflare-container

# Install dependencies (includes wrangler)
npm install
```

## Step 2: Login to Cloudflare

```bash
npx wrangler login
```

This will open a browser to authenticate.

## Step 3: Set R2 Credentials as Secrets

Run these commands and paste your R2 credentials when prompted:

```bash
npx wrangler secret put R2_ENDPOINT
# Paste: https://your-account-id.r2.cloudflarestorage.com

npx wrangler secret put R2_ACCESS_KEY_ID
# Paste: your_access_key

npx wrangler secret put R2_SECRET_ACCESS_KEY
# Paste: your_secret_key

npx wrangler secret put R2_BUCKET
# Paste: your_bucket_name
```

**Where to find these:**
- Go to Cloudflare dashboard → R2 → Your bucket → Settings
- Click "Manage R2 API Tokens" → View/Create API token
- Copy the endpoint, access key, secret key, and bucket name

## Step 4: Deploy Container

```bash
# Make sure Docker is running
docker info

# Deploy (first time takes 5-10 minutes)
npm run deploy
```

You'll see:
```
Building Docker image...
Pushing to Cloudflare...
Deploying Worker...
✨ Deployed!
```

## Step 5: Get Your Worker URL

After deployment, you'll see something like:

```
✨ Deployed video-processor-container
   https://video-processor-container.YOUR_ACCOUNT.workers.dev
```

**Copy this URL!** You'll need it for the frontend.

## Step 6: Test the Deployment

```bash
# Test health endpoint
curl https://video-processor-container.YOUR_ACCOUNT.workers.dev/health
```

Should return:
```json
{"status":"healthy","ffmpeg":"available"}
```

## Step 7: Update Frontend

Add to your Lock-In project's `.env.local`:

```bash
VITE_WORKER_URL=https://video-processor-container.YOUR_ACCOUNT.workers.dev
```

Restart your dev server:
```bash
npm run dev
```

## Step 8: Test End-to-End

1. Go to Lock-In app (http://localhost:3001)
2. Navigate to a project
3. Click "Upload Timelapse"
4. Select a video
5. Check "Create timelapse (server-side processing)"
6. Upload!

## Monitoring

### View Container Logs

```bash
npx wrangler tail
```

### Check Container Status

```bash
npx wrangler containers list
npx wrangler containers images list
```

### View in Dashboard

Go to: Cloudflare Dashboard → Workers & Pages → video-processor-container

## Troubleshooting

### "Containers not available"
- Make sure you're on Workers Paid plan ($5/month)
- Check if Containers is in beta - you may need to request access

### Docker build fails
- Make sure Docker is running: `docker info`
- Check Docker has enough disk space

### "Secret not found"
- Re-run the `wrangler secret put` commands
- Make sure you didn't typo the secret names

### Container takes too long to start
- First deployment can take 5-10 minutes
- Subsequent deploys are faster due to caching

### Processing fails
- Check R2 credentials are correct
- Verify the video exists in R2 with the key you're using
- Check container logs: `npx wrangler tail`

## Cost Estimate

For a hackathon with ~100 video uploads:

- **Workers Paid Plan**: $5/month (required)
- **Container Compute**: ~$0.50-2 (based on processing time)
- **R2 Storage**: ~$0.15 (10GB of videos)
- **Total**: ~$6-8/month

## Next Steps

After deployment works:

1. ~~Delete the separate Worker~~ (we combined it into one deployment)
2. Update `cloudflare-worker/` code if needed (or remove it)
3. Add processing status polling in frontend
4. Add webhooks for completion notifications

## Quick Reference

```bash
# Deploy
npm run deploy

# View logs
npx wrangler tail

# Update secrets
npx wrangler secret put SECRET_NAME

# List deployments
npx wrangler deployments list
```

---

**Need help?** Check the [full DEPLOYMENT.md](../DEPLOYMENT.md) or Cloudflare docs at https://developers.cloudflare.com/containers/
