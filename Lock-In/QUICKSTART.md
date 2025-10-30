# Quick Start Guide - Timelapse Social

Get your timelapse sharing platform up and running in 5 minutes!

## Prerequisites

- Node.js 18+ installed
- A Convex account (free at [convex.dev](https://www.convex.dev))
- A Cloudflare account with R2 enabled (free tier works)

## 🚀 Quick Setup

### 1. Install & Initialize (2 minutes)

```bash
# Navigate to the project
cd lockin-tanstack/Lock-In

# Install dependencies
npm install

# Login to Convex (opens browser)
npx convex login

# Start Convex (creates .env.local)
npx convex dev
```

Keep this terminal open - Convex will run in the background.

### 2. Configure R2 Storage (2 minutes)

Follow the detailed guide in [R2_SETUP_GUIDE.md](./R2_SETUP_GUIDE.md), or here's the quick version:

1. **Create R2 Bucket** at [Cloudflare Dashboard](https://dash.cloudflare.com) → R2
   - Name: `timelapse-videos`
   
2. **Set CORS Policy** on your bucket:
   ```json
   [{
     "AllowedOrigins": ["http://localhost:5173"],
     "AllowedMethods": ["GET", "PUT"],
     "AllowedHeaders": ["Content-Type"]
   }]
   ```

3. **Create API Token** (R2 page → Manage R2 API Tokens):
   - Permissions: Object Read & Write
   - Apply to your bucket only

4. **Set Environment Variables**:
   ```bash
   npx convex env set R2_TOKEN "your-token"
   npx convex env set R2_ACCESS_KEY_ID "your-key-id"
   npx convex env set R2_SECRET_ACCESS_KEY "your-secret"
   npx convex env set R2_ENDPOINT "your-endpoint"
   npx convex env set R2_BUCKET "timelapse-videos"
   ```

### 3. Start the App (1 minute)

Open a **new terminal** (keep Convex running):

```bash
cd lockin-tanstack/Lock-In
npm run dev:web
```

Open [http://localhost:5173](http://localhost:5173) in your browser!

## 🎬 Using the App

### Create Your First Project

1. Click **"Projects"** in the navigation
2. Click **"+ Create Project"**
3. Fill in:
   - Title: "Learning Web Development"
   - Description: "Building full-stack apps"
   - Target Hours: 10
4. Click **"Create"**

### Upload a Timelapse

1. Click on your project
2. Click **"+ Upload Timelapse"**
3. Select a video file (any format)
4. Enter duration in minutes
5. Click **"Upload"** and wait for completion

### Explore the Feed

1. Click **"Feed"** in navigation
2. Browse all timelapses from the community
3. Click any video to view details
4. Like and comment on videos

## 🏗️ Project Structure

```
lockin-tanstack/Lock-In/
├── convex/              # Backend (Convex functions)
│   ├── schema.ts       # Database tables
│   ├── projects.ts     # Project operations
│   ├── timelapses.ts   # Video operations
│   ├── social.ts       # Likes & comments
│   └── videos.ts       # Video URL generation
│
├── src/
│   ├── routes/         # Pages
│   │   ├── index.tsx           # Feed page
│   │   ├── projects.tsx        # Projects list
│   │   ├── projects.$projectId.tsx  # Project detail
│   │   └── timelapse.$timelapseId.tsx  # Video player
│   │
│   └── components/     # Reusable components
│       ├── VideoUpload.tsx     # Upload modal
│       └── VideoPlayer.tsx     # Video player
│
├── README.md           # Full documentation
├── R2_SETUP_GUIDE.md   # Detailed R2 setup
└── package.json
```

## 📝 Available Scripts

```bash
# Development (runs both frontend & backend)
npm run dev

# Frontend only
npm run dev:web

# Backend only
npm run dev:convex

# Build for production
npm run build

# Type checking and linting
npm run lint
```

## 🔧 Common Issues

### "Cannot find module 'convex/_generated/api'"

**Fix**: Convex is still initializing. Wait a few seconds and it will auto-generate.

### Videos won't upload

**Fix**: Check that R2 environment variables are set:
```bash
npx convex env list
```

### CORS error in browser

**Fix**: Verify CORS policy in R2 bucket includes `http://localhost:5173`

### Convex functions not updating

**Fix**: Make sure `npx convex dev` is running in a terminal

## 🎯 What's Next?

- **Add Authentication**: Integrate [Convex Auth](https://docs.convex.dev/auth)
- **Thumbnail Generation**: Auto-generate video thumbnails
- **Video Transcoding**: Process videos for optimal streaming
- **Search**: Add search functionality for projects
- **Categories**: Organize projects by category/tags
- **Follow System**: Follow users and see their projects
- **Notifications**: Get notified about new comments/likes

## 📚 Learn More

- [Convex Documentation](https://docs.convex.dev)
- [TanStack Start Guide](https://tanstack.com/start)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [Full README](./README.md)

## 🆘 Need Help?

- **Convex Discord**: [convex.dev/community](https://www.convex.dev/community)
- **Cloudflare Community**: [community.cloudflare.com](https://community.cloudflare.com/)
- **GitHub Issues**: Open an issue in the repo

---

**Happy building! 🚀**

