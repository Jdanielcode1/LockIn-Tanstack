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
      "http://localhost:3000"
    ],
    "AllowedMethods": [
      "GET",
      "PUT"
    ],
    "AllowedHeaders": [
      "Content-Type"
    ]
  }
]
```

5. Click **Save**

**Important**: When you deploy to production, add your production domain to `AllowedOrigins`:

```json
{
  "AllowedOrigins": [
    "http://localhost:5173",
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
- Verify CORS policy includes your origin (e.g., `http://localhost:5173`)
- Check that `AllowedMethods` includes both `GET` and `PUT`
- Make sure `Content-Type` is in `AllowedHeaders`

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

## Need Help?

- Cloudflare Community: https://community.cloudflare.com/
- Convex Discord: https://www.convex.dev/community
- GitHub Issues: Create an issue in the project repository

