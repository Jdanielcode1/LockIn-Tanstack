# User System Implementation Progress

## ✅ Completed

### 1. Database Schema Updated
- ✅ Added `users` table with username, displayName, email, bio, avatarKey, location
- ✅ Added `userId` field to all existing tables (projects, timelapses, likes, comments)
- ✅ Added proper indexes for efficient querying
- ✅ Data manually cleared by user

### 2. Convex Backend Functions

#### Users (`convex/users.ts`) ✅
- `createUser` - Create new user with validation
- `getUser` - Get user by ID
- `getUserByUsername` - Get user by username
- `updateProfile` - Update user profile info
- `updateAvatar` - Update user avatar key
- `searchUsers` - Search users by username or display name

#### R2 Storage (`convex/r2.ts`) ✅
- Updated to support both `videos/` and `avatars/` prefixes in same bucket
- `getVideoUrl` - Query for video URLs
- `getAvatarUrl` - Query for avatar URLs
- Uses same R2 bucket with subfolder organization

#### Projects (`convex/projects.ts`) ✅
- `create` - Now requires `userId`
- `list` - Optional `userId` filter
- `get` - Returns user info with project
- Authorization: Users can only access their own projects

#### Timelapses (`convex/timelapses.ts`) ✅
- `create` - Now requires `userId`
- `listFeed` - Enriched with user data (username, displayName, avatarKey)
- Returns user info with each timelapse

#### Social (`convex/social.ts`) ✅
- `toggleLike` - Now requires `userId`, proper like/unlike logic
- `addComment` - Now requires `userId`
- `getComments` - Returns user info with each comment
- `isLiked` - Check if specific user liked a timelapse

#### Stats (`convex/stats.ts`) ✅
- `getOverallStats` - Optional `userId` for per-user stats
- `getContributionData` - Optional `userId` for per-user contributions
- `getActivityFeed` - Activity feed support

### 3. Frontend Utilities
- ✅ Created `tempUser.ts` for temporary user management (localStorage)
- Functions: `getTempUser()`, `setTempUser()`, `clearTempUser()`, `hasTempUser()`

## 🚧 In Progress / Next Steps

### 4. Avatar Upload Component
- Create `AvatarUpload.tsx` component
- Features needed:
  - File picker with drag-and-drop
  - Image preview (circular crop)
  - Upload to R2 with `avatars/` prefix
  - Progress indicator
  - File validation (type, size)

### 5. User Profile Edit Component
- Create `UserProfileEdit.tsx` component
- Features needed:
  - Avatar upload section
  - Display name input
  - Bio textarea
  - Email input
  - Location input
  - Save button

### 6. User Setup Flow
- Create initial user setup modal/page
- Appears on first visit if no user in localStorage
- Collects: username, display name, optional bio
- Creates user in Convex
- Stores userId in localStorage

### 7. Update Existing UI Components

#### Feed (`src/routes/index.tsx`)
- Update to pass `userId` to mutations
- Use real user avatars instead of hardcoded "TC"
- Display actual usernames from `timelapse.user`
- Update like handler to include userId
- Update comment handler to include userId

#### Profile (`src/routes/projects.tsx`)
- Use real user data from Convex
- Display actual avatar (not gradient placeholder)
- Show real username and displayName
- Pass `userId` when fetching stats
- Add "Edit Profile" functionality

#### Comments (`src/components/InlineComments.tsx`)
- Display real user avatars from `comment.user.avatarKey`
- Show actual usernames from `comment.user.username`
- Use R2 avatarUrl query for avatars

#### Project Creation (`src/components/CreateProjectModal.tsx`)
- Pass `userId` to `projects.create` mutation

#### Video Upload (`src/components/VideoUpload.tsx`)
- Pass `userId` to `timelapses.create` mutation
- Ensure videoKey uses `videos/` prefix

#### Video Player (`src/components/InlineVideoPlayer.tsx`)
- Update to use `api.r2.getVideoUrl` query instead of old `api.videos.getVideoUrl`

## 📋 Implementation Plan

### Phase 1: Core User Setup (Next)
1. Create AvatarUpload component
2. Create UserProfileEdit component
3. Create user setup modal for first-time users
4. Test user creation and avatar upload

### Phase 2: UI Integration
5. Update feed to use real user data
6. Update profile page to use real user data
7. Update comments to show real user info
8. Update project/video creation to include userId

### Phase 3: Testing & Polish
9. Test complete flow from user creation to interactions
10. Verify all userId references work correctly
11. Test avatar uploads and display
12. Ensure R2 subfolder structure works (videos/ and avatars/)

## 🎯 Key Features

### Avatar System
- Stored in R2 under `avatars/` prefix
- Format: `avatars/{userId}_{timestamp}.{ext}`
- Supported formats: jpg, png, gif, webp
- Size limit: 5MB
- Circular display in UI

### User System (No Auth Yet)
- Temporary localStorage-based user management
- Username: unique, alphanumeric + underscores, 3-20 chars
- Display name: 1-50 chars, can include spaces
- Bio, email, location: optional fields

### Data Ownership
- All projects tied to userId
- All timelapses tied to userId
- All likes tied to userId (proper toggle logic)
- All comments tied to userId

## 🔄 Migration Notes
- Old data was manually cleared
- Fresh start with new schema
- All new data will have proper user ownership

## 📝 Testing Checklist
- [ ] Create first user
- [ ] Upload avatar
- [ ] Create project
- [ ] Upload video
- [ ] Like/unlike timelapse
- [ ] Add comment
- [ ] View profile with stats
- [ ] Edit profile info
- [ ] Update avatar
- [ ] Verify R2 storage structure

