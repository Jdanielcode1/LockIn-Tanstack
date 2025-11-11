# Cloudflare R2 Setup Guide

This guide walks you through setting up Cloudflare R2 for video storage in the Timelapse Social app.

## Prerequisites

- A Cloudflare account (free tier works)
- Convex project already initialized

## Step 1: Create an R2 Bucket

1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com)
2. In the left sidebar, click **R2 Object Storage**
3. Click **Create bucket**
4. Enter a bucket name (e.g., `timelapse-videos`)
   - Must be unique across all Cloudflare R2
   - Use lowercase letters, numbers, and hyphens only
5. Choose a location hint (optional, for better performance)
6. Click **Create bucket**

## Step 2: Configure CORS Policy

CORS (Cross-Origin Resource Sharing) allows your web app to upload/download videos from R2.

1. Go to your bucket's settings page
2. Scroll to **CORS policy**
3. Click **Edit CORS policy**
4. Add the following JSON:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:3001"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "HEAD"
    ],
    "AllowedHeaders": [
      "Content-Type",
      "Range",
      "Accept-Ranges"
    ],
    "ExposeHeaders": [
      "Content-Length",
      "Content-Range",
      "Accept-Ranges"
    ]
  }
]
```

5. Click **Save**

**Important Notes**:
- `Range` and `Accept-Ranges` headers are **required for video playback**. These enable video seeking/scrubbing and partial content requests, which browsers need to efficiently load and play videos.
- `ExposeHeaders` allows the browser to read these headers from R2 responses, which is necessary for proper video streaming.
- When you deploy to production, add your production domain to `AllowedOrigins`:

```json
{
  "AllowedOrigins": [
    "http://localhost:5173",
    "http://localhost:3001",
    "https://your-production-domain.com"
  ],
  ...
}
```

## Step 3: Create API Token

R2 API tokens allow your Convex backend to access the bucket.

1. From the R2 main page, click **Manage R2 API Tokens** (top right)
2. Click **Create API Token**
3. Configure the token:
   - **Token name**: `timelapse-social-convex` (or any name you prefer)
   - **Permissions**: Select **Object Read & Write**
   - **Specify bucket(s)**: Choose **Apply to specific buckets only**
   - Select your bucket from the dropdown
4. (Optional) Set a **TTL** (time to live) for the token
5. Click **Create API Token**

## Step 4: Save Credentials

You'll see a screen with four important values. **Save these immediately** - they won't be shown again:

1. **Token Value** (starts with something like `eyJ...`)
2. **Access Key ID** (20 characters)
3. **Secret Access Key** (40 characters)
4. **Endpoint** (URL like `https://abcd1234.r2.cloudflarestorage.com`)

Copy these somewhere safe (like a password manager).

## Step 5: Set Convex Environment Variables

Now configure your Convex deployment with these credentials:

```bash
# Navigate to your project directory
cd lockin-tanstack/Lock-In

# Set each environment variable
npx convex env set R2_TOKEN "paste-your-token-value-here"
npx convex env set R2_ACCESS_KEY_ID "paste-your-access-key-id-here"
npx convex env set R2_SECRET_ACCESS_KEY "paste-your-secret-access-key-here"
npx convex env set R2_ENDPOINT "paste-your-endpoint-here"
npx convex env set R2_BUCKET "your-bucket-name"
```

**Example:**

```bash
npx convex env set R2_TOKEN "eyJhbGciOiJIUzI1NiIsInR5cCI..."
npx convex env set R2_ACCESS_KEY_ID "a1b2c3d4e5f6g7h8i9j0"
npx convex env set R2_SECRET_ACCESS_KEY "A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0"
npx convex env set R2_ENDPOINT "https://abcd1234.r2.cloudflarestorage.com"
npx convex env set R2_BUCKET "timelapse-videos"
```

## Step 6: Verify Setup

To verify everything is configured correctly:

1. Start your Convex backend:
   ```bash
   npm run dev:convex
   ```

2. Check the console for any R2-related errors

3. Start your frontend:
   ```bash
   npm run dev:web
   ```

4. Try creating a project and uploading a video

## Troubleshooting

### "Access Denied" Error

**Problem**: Getting access denied when uploading videos

**Solutions**:
- Verify your API token has "Object Read & Write" permissions
- Check that the token is scoped to the correct bucket
- Ensure all environment variables are set correctly

### CORS Error

**Problem**: Browser shows CORS policy error

**Solutions**:
- Verify CORS policy includes your origin (e.g., `http://localhost:3001`)
- Check that `AllowedMethods` includes `GET`, `PUT`, and `HEAD`
- Make sure `Content-Type`, `Range`, and `Accept-Ranges` are in `AllowedHeaders`
- Verify `ExposeHeaders` is set correctly

### Video Won't Play (Thumbnails Show)

**Problem**: Video thumbnails load but videos stay in loading state or fail to play

**Solutions**:
1. **Check CORS headers**: Missing `Range` and `Accept-Ranges` headers prevent video playback
   - Update CORS policy to include these headers (see Step 2)
2. **Check browser console**: Look for network errors or video element errors
   - `MEDIA_ERR_NETWORK`: Network/CORS issue
   - `MEDIA_ERR_SRC_NOT_SUPPORTED`: Format issue or URL expired
   - `MEDIA_ERR_DECODE`: Video encoding issue
3. **Verify signed URL**: Copy video URL from network tab and test in new browser tab
   - If URL returns 403: Check R2 permissions
   - If URL returns 404: Video may not exist in bucket
4. **Check URL expiration**: Signed URLs expire after 24 hours
   - Use retry button to fetch fresh URL
5. **Verify video format**: R2 bucket should contain valid video files (MP4, WebM, etc.)
6. **Check video encoding**: Ensure videos are web-compatible (H.264 codec recommended)

### "Bucket Not Found" Error

**Problem**: Backend can't find the bucket

**Solutions**:
- Double-check the bucket name matches exactly (case-sensitive)
- Verify the `R2_BUCKET` environment variable is set
- Ensure the endpoint URL is correct for your account

### Environment Variables Not Working

**Problem**: Changes to environment variables don't take effect

**Solutions**:
- Restart your Convex backend (`npm run dev:convex`)
- Run `npx convex env list` to verify variables are set
- Check for typos in variable names

## Security Best Practices

1. **Never commit credentials** to version control
2. **Use separate tokens** for development and production
3. **Set short TTLs** on tokens when possible
4. **Rotate tokens** regularly (every 90 days recommended)
5. **Scope tokens** to specific buckets only
6. **Monitor usage** in Cloudflare dashboard

## Cost Information

Cloudflare R2 pricing (as of 2025):
- **Storage**: $0.015 per GB/month
- **Class A Operations** (PUT, POST): $4.50 per million
- **Class B Operations** (GET, HEAD): $0.36 per million
- **No egress fees** (unlike S3)

**Free Tier**:
- 10 GB storage
- 1 million Class A operations
- 10 million Class B operations

For a typical timelapse app:
- 100 videos at 50MB each = 5GB storage = **FREE**
- 100 uploads = 100 Class A ops = **FREE**
- 10,000 video views = 10,000 Class B ops = **FREE**

## Production Deployment

When deploying to production:

1. Create a **separate R2 bucket** for production
2. Create a **new API token** for production
3. Set environment variables in **Convex production** deployment:
   ```bash
   npx convex deploy --prod
   npx convex env set R2_TOKEN "..." --prod
   # ... set other variables with --prod flag
   ```
4. Update **CORS policy** to include production domain
5. Consider setting up **Cloudflare Access** for additional security

## Additional Resources

- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [R2 API Reference](https://developers.cloudflare.com/r2/api/s3/)
- [Convex R2 Component Docs](https://www.convex.dev/components/cloudflare-r2)
- [R2 Pricing Calculator](https://www.cloudflare.com/products/r2/)

## Large File Uploads (>100MB) - Multipart Upload Actor

For files larger than 100MB, the app automatically uses a **Cloudflare Actor-based multipart upload system** that can handle files up to 5GB (or even larger, up to 5TB with proper configuration).

### How It Works

1. Files >100MB are automatically detected by the frontend
2. Upload is split into 10MB chunks
3. Chunks are uploaded in parallel (5 concurrent) to a Cloudflare Durable Object
4. The Actor tracks upload progress in SQLite storage
5. When all chunks complete, R2 multipart upload is finalized

### Setup Instructions

1. **Deploy the Upload Actor**:
   ```bash
   cd cloudflare-upload-actor
   npm install
   npm run deploy
   ```

2. **Copy the deployed URL** and add to `.env`:
   ```env
   VITE_UPLOAD_ACTOR_URL=https://lock-in-upload-actor.your-subdomain.workers.dev
   ```

3. **Restart your frontend** to pick up the new environment variable

### Benefits

- **No browser memory limits**: Files are streamed directly, not loaded into RAM
- **Resume capability**: Interrupted uploads can resume from where they left off
- **Parallel uploads**: Multiple chunks upload simultaneously for faster speeds
- **Progress tracking**: Real-time progress with completed/total parts display
- **Automatic**: No code changes needed, works transparently for large files

### Cost Implications

**For a 1GB file upload:**
- ~100 Actor requests (100 parts × 10MB each): ~$0.000015
- ~100 R2 Class A operations: ~$0.00045
- **Total: Less than $0.001 per upload**

The multipart system is very cost-effective and scales well to large files.

### Troubleshooting

**Large file upload fails immediately:**
- Verify `VITE_UPLOAD_ACTOR_URL` is set in `.env`
- Check that the Upload Actor is deployed successfully
- Verify R2 bucket binding in `cloudflare-upload-actor/wrangler.toml`

**Upload progress stalls mid-way:**
- Check browser console for error messages
- Verify network connectivity
- Check Cloudflare dashboard for Actor errors

**Parts upload but don't complete:**
- View Actor logs with: `cd cloudflare-upload-actor && npm run tail`
- Check that all parts reached the Actor
- Verify R2 multipart complete operation didn't error

For more details, see `cloudflare-upload-actor/README.md`.

## Need Help?

- Cloudflare Community: https://community.cloudflare.com/
- Convex Discord: https://www.convex.dev/community
- GitHub Issues: Create an issue in the project repository

