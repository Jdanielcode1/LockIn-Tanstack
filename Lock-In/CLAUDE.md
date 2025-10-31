# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lock-In is a social platform for sharing project progress through timelapse videos. Users create projects with time goals, upload timelapse videos of their work sessions, and engage with the community through likes and comments.

**Tech Stack:**
- Frontend: TanStack Start (React 19, TanStack Router, React Query)
- Backend: Convex (serverless backend with real-time database)
- Storage: Cloudflare R2 (via @convex-dev/r2 component)
- Styling: Tailwind CSS v4

## Development Commands

### Starting Development
```bash
# Run both frontend and Convex backend together
npm run dev

# Or run separately:
npm run dev:web      # Frontend only (port 3001)
npm run dev:convex   # Convex backend only
```

### Build and Type Checking
```bash
npm run build        # Build frontend + TypeScript check
npm run lint         # Run TypeScript + ESLint
npm run format       # Format code with Prettier
```

### Convex Operations
```bash
npx convex dev       # Start Convex in development mode
npx convex deploy    # Deploy Convex backend to production
npx convex env set KEY "value"  # Set environment variables
npx convex dashboard # Open Convex dashboard
```

## Architecture

### Backend: Convex Database Schema

The database schema is defined in `convex/schema.ts` with these core tables:

**users** - User profiles (temporary localStorage-based auth currently)
- Indexed by `username`
- Contains: username, displayName, email, bio, avatarKey (R2), location

**projects** - User-created projects with time goals
- Indexed by: user, status, and user+status combination
- Contains: userId, title, description, targetHours, completedHours, status

**timelapses** - Video recordings of work sessions
- Indexed by: project, user, and uploadedAt
- Contains: userId, projectId, videoKey (R2), thumbnailKey (R2), durationMinutes, viewCount, likeCount

**likes** and **comments** - Social engagement on timelapses
- Indexed for efficient lookups by timelapse and user

### Convex Backend Organization

**Convex functions are organized by domain:**

- `convex/users.ts` - User CRUD operations
- `convex/projects.ts` - Project management (create, list, get, updateStatus, deleteProject)
- `convex/timelapses.ts` - Video timelapse operations
- `convex/social.ts` - Likes and comments functionality
- `convex/stats.ts` - Analytics and statistics
- `convex/r2.ts` - R2 storage helpers (generateUploadUrl, getVideoUrl, getAvatarUrl)
- `convex/convex.config.ts` - Convex app configuration with R2 component

### Frontend: TanStack Router + React Query

**Router setup (`src/router.tsx`):**
- Uses `@tanstack/react-router-with-query` to integrate React Query
- ConvexQueryClient provides the queryFn for all queries
- Router wraps app in ConvexProvider for real-time subscriptions

**Route structure:**
- `src/routes/__root.tsx` - Root layout with navigation, UserProvider
- `src/routes/index.tsx` - Public feed of all timelapses
- `src/routes/projects.tsx` - User's project list and profile
- `src/routes/projects.$projectId.tsx` - Project detail page
- `src/routes/timelapse.$timelapseId.tsx` - Video player page

**Path aliases:** `~/` maps to `src/` (configured in tsconfig.json and vite.config.ts)

### User Authentication

**Current implementation uses temporary localStorage-based users:**
- `src/utils/tempUser.ts` - localStorage user management (no real auth yet)
- `src/components/UserProvider.tsx` - Context provider that checks for user on mount
- Shows `UserSetupModal` if no user exists
- Users are stored in Convex `users` table after setup

**To implement real authentication:** Consider using Convex Auth (https://docs.convex.dev/auth)

### File Storage with Cloudflare R2

**R2 integration via @convex-dev/r2 component:**
- Videos stored with `videos/` prefix
- Avatars stored with `avatars/` prefix
- Upload flow: Client requests signed upload URL → uploads directly to R2 → Convex receives webhook
- Download: Convex generates signed URLs with configurable expiration (24hrs for videos, 7 days for avatars)

**Required environment variables (set via `npx convex env set`):**
- R2_TOKEN
- R2_ACCESS_KEY_ID
- R2_SECRET_ACCESS_KEY
- R2_ENDPOINT
- R2_BUCKET

### Key Components

- `VideoUpload.tsx` - Handles video upload to R2, creates timelapse record
- `VideoPlayer.tsx` - Full-page video player
- `InlineVideoPlayer.tsx` - Video player for feed
- `UserSetupModal.tsx` - First-time user onboarding
- `UserProfileEdit.tsx` - Edit user profile
- `AvatarUpload.tsx` - Upload user avatars to R2
- `CreateProjectModal.tsx` - Create new projects
- `ContributionHeatmap.tsx` - GitHub-style activity visualization

## Important Patterns

### Convex Queries and Mutations

**Always use validators:**
```typescript
export const myQuery = query({
  args: { id: v.id("tableName") },
  returns: v.object({ ... }),
  handler: async (ctx, args) => { ... }
})
```

**Use indexes for efficient queries:**
```typescript
// Good - uses index
await ctx.db
  .query("timelapses")
  .withIndex("by_project", (q) => q.eq("projectId", projectId))
  .collect()

// Avoid - full table scan
await ctx.db.query("timelapses").filter(t => t.projectId === projectId).collect()
```

### React Query with Convex

**ConvexQueryClient handles queryFn automatically:**
```typescript
// In components, just pass the Convex function reference
const { data } = useSuspenseQuery({
  queryKey: ["timelapses.get", { timelapseId }]
})
```

The queryKey format is `[functionPath, args]` where functionPath is like `"timelapses.get"` (file.export).

### R2 Upload Pattern

1. Call `r2.generateUploadUrl()` mutation to get signed URL
2. Upload file directly to R2 using fetch/axios
3. Create database record with the R2 key
4. Use `r2.getUrl()` query to generate signed download URLs

## Development Notes

- **No authentication** - Current implementation uses localStorage temp users. Real auth needed for production.
- **TypeScript strict mode** - Enabled with strict type checking
- **ESLint config** - Uses TanStack and Convex recommended configs
- **Vite dev server** - Runs on port 3001 by default
- **Route generation** - TanStack Router auto-generates `routeTree.gen.ts` from route files
- **CSS** - Tailwind v4 with GitHub-style dark theme colors
- **Video processing** - Videos stored as-is; consider adding transcoding for production

## File Structure

```
Lock-In/
├── convex/              # Convex backend
│   ├── _generated/      # Auto-generated (git-ignored)
│   ├── schema.ts        # Database schema
│   ├── convex.config.ts # App config with R2
│   ├── r2.ts            # R2 helpers
│   ├── users.ts         # User functions
│   ├── projects.ts      # Project functions
│   ├── timelapses.ts    # Timelapse functions
│   ├── social.ts        # Social functions
│   └── stats.ts         # Statistics
├── src/
│   ├── routes/          # TanStack Router routes
│   │   ├── __root.tsx   # Root layout
│   │   └── ...          # Page routes
│   ├── components/      # React components
│   ├── utils/           # Utilities (tempUser, etc)
│   ├── styles/          # CSS files
│   └── router.tsx       # Router config
├── public/              # Static assets
├── vite.config.ts       # Vite configuration
├── tsconfig.json        # TypeScript config
└── package.json         # Dependencies and scripts
```

## Testing Changes

When making changes:
1. Run `npm run lint` to check types and ESLint
2. Test in browser at http://localhost:3001
3. Check Convex dashboard for backend logs/data
4. Verify R2 uploads in Cloudflare dashboard if touching storage
