# Timelapse Social - Project Progress Sharing Platform

A social platform built with TanStack Start and Convex where users can create projects, upload timelapse videos of their work, and share their progress with the community.

## Features

- **Project Management**: Create projects with time goals and track completion
- **Video Uploads**: Upload timelapse videos directly to Cloudflare R2 storage
- **Social Feed**: Browse timelapses from all projects in a beautiful grid layout
- **Engagement**: Like and comment on timelapses
- **Real-time Updates**: Automatic updates via Convex subscriptions
- **Progress Tracking**: Visual progress bars showing hours completed vs. target

## Tech Stack

- **Frontend**: TanStack Start (React, TanStack Router, React Query)
- **Backend**: Convex (serverless backend with real-time database)
- **Storage**: Cloudflare R2 (video file storage)
- **Styling**: Tailwind CSS

## Prerequisites

1. Node.js 18+ installed
2. A Convex account ([sign up here](https://www.convex.dev))
3. A Cloudflare account with R2 enabled

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Convex

```bash
# Login to Convex
npx convex login

# Initialize your Convex project
npx convex dev
```

This will create a `.env.local` file with your Convex deployment URL.

### 3. Set Up Cloudflare R2

#### Create an R2 Bucket

1. Go to your [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to R2 Object Storage
3. Click "Create bucket"
4. Name your bucket (e.g., `timelapse-videos`)
5. Click "Create bucket"

#### Configure CORS

Add a CORS policy to your bucket:

```json
[
  {
    "AllowedOrigins": ["http://localhost:5173", "http://localhost:3000"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["Content-Type"]
  }
]
```

For production, replace `localhost` with your production domain.

#### Create API Token

1. On the R2 main page, click "Manage R2 API Tokens"
2. Click "Create API Token"
3. Set permissions to "Object Read & Write"
4. Under "Specify bucket", select your bucket
5. Click "Create API Token"
6. Save the following values:
   - Token Value (`R2_TOKEN`)
   - Access Key ID (`R2_ACCESS_KEY_ID`)
   - Secret Access Key (`R2_SECRET_ACCESS_KEY`)
   - Endpoint (`R2_ENDPOINT`)

#### Set Environment Variables

```bash
npx convex env set R2_TOKEN "your-token-value"
npx convex env set R2_ACCESS_KEY_ID "your-access-key-id"
npx convex env set R2_SECRET_ACCESS_KEY "your-secret-access-key"
npx convex env set R2_ENDPOINT "your-r2-endpoint"
npx convex env set R2_BUCKET "your-bucket-name"
```

### 4. Run the Development Server

```bash
# Terminal 1: Run Convex backend
npm run dev:convex

# Terminal 2: Run the frontend
npm run dev:web
```

Or run both together:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Project Structure

```
lockin-tanstack/Lock-In/
├── convex/                    # Backend code
│   ├── schema.ts             # Database schema
│   ├── convex.config.ts      # R2 component configuration
│   ├── r2.ts                 # R2 upload/download helpers
│   ├── projects.ts           # Project CRUD operations
│   ├── timelapses.ts         # Timelapse CRUD operations
│   ├── social.ts             # Likes and comments
│   └── videos.ts             # Video URL generation
├── src/
│   ├── routes/               # TanStack Router routes
│   │   ├── __root.tsx       # Root layout with navigation
│   │   ├── index.tsx        # Public feed
│   │   ├── projects.tsx     # Projects list
│   │   ├── projects.$projectId.tsx  # Project detail
│   │   └── timelapse.$timelapseId.tsx  # Video player
│   └── components/
│       ├── VideoUpload.tsx  # R2 video upload component
│       └── VideoPlayer.tsx  # Video player component
└── package.json
```

## Database Schema

### Projects
- `title`: Project name
- `description`: Project description
- `targetHours`: Goal in hours
- `completedHours`: Progress in hours
- `status`: "active" | "completed" | "paused"

### Timelapses
- `projectId`: Reference to project
- `videoKey`: R2 storage key
- `durationMinutes`: Video duration
- `viewCount`: Number of views
- `likeCount`: Number of likes

### Likes
- `timelapseId`: Reference to timelapse
- `createdAt`: Timestamp

### Comments
- `timelapseId`: Reference to timelapse
- `content`: Comment text
- `createdAt`: Timestamp

## Key Features Implemented

✅ Project creation and management
✅ Video upload to Cloudflare R2
✅ Public feed with pagination
✅ Video player with signed URLs
✅ Like/unlike functionality
✅ Comments system
✅ Progress tracking
✅ Real-time updates
✅ Responsive design

## Development

### Available Scripts

- `npm run dev` - Run both frontend and backend
- `npm run dev:web` - Run frontend only
- `npm run dev:convex` - Run Convex backend only
- `npm run build` - Build for production
- `npm run lint` - Run TypeScript and ESLint checks

### Adding New Features

1. **Database Changes**: Edit `convex/schema.ts`
2. **Backend Logic**: Create/edit files in `convex/`
3. **Frontend Routes**: Add files in `src/routes/`
4. **Components**: Add files in `src/components/`

## Deployment

### Deploy Convex Backend

```bash
npx convex deploy
```

### Deploy Frontend

The frontend can be deployed to any platform that supports TanStack Start:
- Vercel
- Netlify
- Cloudflare Pages

Make sure to:
1. Set environment variables in your deployment platform
2. Update CORS settings in R2 to include your production domain

## Notes

- **Authentication**: Currently, the app doesn't have user authentication. This is intentional for the MVP. To add auth, consider [Convex Auth](https://docs.convex.dev/auth).
- **Video Processing**: Videos are stored as-is. Consider adding video processing/transcoding for better performance.
- **Thumbnails**: Currently using placeholders. Implement thumbnail generation for better UX.

## Resources

- [Convex Documentation](https://docs.convex.dev)
- [TanStack Start Documentation](https://tanstack.com/start)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [Convex R2 Component](https://www.convex.dev/components/cloudflare-r2)

## License

MIT

