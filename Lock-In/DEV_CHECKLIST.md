# Development Checklist

Use this checklist to get started with the Timelapse Social platform.

## 🎯 Getting Started

### Initial Setup
- [ ] Install Node.js 18+ if not already installed
- [ ] Clone/navigate to the project directory
- [ ] Run `npm install` to install dependencies
- [ ] Create Convex account at [convex.dev](https://www.convex.dev)
- [ ] Create Cloudflare account (free tier)

### Convex Setup
- [ ] Run `npx convex login` (opens browser)
- [ ] Run `npx convex dev` to initialize project
- [ ] Verify `.env.local` file was created with `CONVEX_DEPLOYMENT` URL
- [ ] Keep `npx convex dev` running in a terminal

### Cloudflare R2 Setup
- [ ] Create R2 bucket in Cloudflare dashboard
- [ ] Configure CORS policy (see R2_SETUP_GUIDE.md)
- [ ] Create API token with Read & Write permissions
- [ ] Save all 4 credentials (token, access key, secret, endpoint)
- [ ] Set environment variables in Convex:
  ```bash
  npx convex env set R2_TOKEN "..."
  npx convex env set R2_ACCESS_KEY_ID "..."
  npx convex env set R2_SECRET_ACCESS_KEY "..."
  npx convex env set R2_ENDPOINT "..."
  npx convex env set R2_BUCKET "your-bucket-name"
  ```
- [ ] Verify with `npx convex env list`

### Start Development
- [ ] Terminal 1: `npx convex dev` (if not already running)
- [ ] Terminal 2: `npm run dev:web`
- [ ] Open browser to `http://localhost:5173`
- [ ] Check console for errors

## ✅ Testing the App

### Basic Functionality
- [ ] Homepage loads without errors
- [ ] Can navigate to "Projects" page
- [ ] Can create a new project
- [ ] Can view project details
- [ ] Can navigate back to projects list

### Video Upload
- [ ] Click "Upload Timelapse" on a project
- [ ] Select a small video file (< 10MB for testing)
- [ ] Enter duration in minutes
- [ ] Upload completes successfully
- [ ] Video appears in project timelapse gallery
- [ ] Video appears in public feed

### Video Playback
- [ ] Click on a timelapse in the feed
- [ ] Video player loads
- [ ] Video plays with controls
- [ ] View count increments

### Social Features
- [ ] Can like a video
- [ ] Like count updates
- [ ] Can unlike a video
- [ ] Can add a comment
- [ ] Comment appears in list
- [ ] Can see timestamp on comment

### Project Management
- [ ] Can change project status (Active/Paused/Completed)
- [ ] Progress bar updates when videos are uploaded
- [ ] Completed hours calculation is correct
- [ ] Can delete a timelapse
- [ ] Progress decreases when timelapse deleted
- [ ] Can delete entire project

## 🔍 Troubleshooting

### If Feed is Empty
- [ ] Create at least one project
- [ ] Upload at least one video to that project
- [ ] Refresh the page

### If Upload Fails
- [ ] Check browser console for errors
- [ ] Verify R2 environment variables are set: `npx convex env list`
- [ ] Check R2 CORS policy includes `http://localhost:5173`
- [ ] Try a smaller video file first
- [ ] Check R2 dashboard for quota/storage limits

### If Video Won't Play
- [ ] Check browser console for errors
- [ ] Verify video was uploaded successfully to R2
- [ ] Check R2 bucket in Cloudflare dashboard
- [ ] Try a different video format (MP4 recommended)
- [ ] Check that signed URL is being generated

### If Real-time Updates Don't Work
- [ ] Verify `npx convex dev` is still running
- [ ] Check terminal for Convex errors
- [ ] Restart Convex: Stop and run `npx convex dev` again
- [ ] Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+F5)

## 📝 Code Changes Checklist

### Before Making Changes
- [ ] Create a new git branch
- [ ] Pull latest changes if working with a team
- [ ] Run `npm run lint` to check for issues

### When Changing Database Schema
- [ ] Update `convex/schema.ts`
- [ ] Wait for Convex to regenerate types
- [ ] Update related Convex functions
- [ ] Update TypeScript types in components
- [ ] Test thoroughly - schema changes affect everything

### When Adding New Convex Functions
- [ ] Add proper validators for args and returns
- [ ] Consider using `internalMutation` for internal-only functions
- [ ] Add error handling
- [ ] Test with Convex dashboard
- [ ] Update frontend to use new function

### When Adding New Routes
- [ ] Create file in `src/routes/`
- [ ] Follow naming convention (use `$param` for dynamic routes)
- [ ] Add route to navigation if needed
- [ ] Test navigation between routes
- [ ] Check route regeneration in `src/routeTree.gen.ts`

### When Adding New Components
- [ ] Create in `src/components/`
- [ ] Use TypeScript for type safety
- [ ] Add proper prop types
- [ ] Make responsive (test on mobile)
- [ ] Add loading/error states

## 🚀 Pre-Deployment Checklist

### Testing
- [ ] All features work locally
- [ ] No console errors
- [ ] Test on different browsers
- [ ] Test on mobile device
- [ ] Test with larger video files
- [ ] Test pagination on all lists
- [ ] Test error states (network offline, invalid data, etc.)

### Production R2 Setup
- [ ] Create separate production R2 bucket
- [ ] Create separate production API token
- [ ] Update CORS to include production domain
- [ ] Test upload from production domain

### Convex Deployment
- [ ] Run `npx convex deploy --prod`
- [ ] Set production environment variables:
  ```bash
  npx convex env set R2_TOKEN "..." --prod
  npx convex env set R2_ACCESS_KEY_ID "..." --prod
  npx convex env set R2_SECRET_ACCESS_KEY "..." --prod
  npx convex env set R2_ENDPOINT "..." --prod
  npx convex env set R2_BUCKET "..." --prod
  ```
- [ ] Verify with `npx convex env list --prod`

### Frontend Deployment
- [ ] Build: `npm run build`
- [ ] Check build output for errors
- [ ] Deploy to hosting (Vercel, Netlify, Cloudflare Pages)
- [ ] Set `CONVEX_DEPLOYMENT` env var to production URL
- [ ] Test production deployment

### Post-Deployment
- [ ] Test all features on production
- [ ] Monitor Convex dashboard for errors
- [ ] Monitor R2 usage and costs
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Document any production-specific setup

## 🎨 Optional Enhancements

### UI Improvements
- [ ] Add video thumbnails (extract first frame)
- [ ] Add loading skeletons
- [ ] Improve empty states with illustrations
- [ ] Add toast notifications for actions
- [ ] Add confirmation modals for destructive actions
- [ ] Improve mobile navigation

### Features
- [ ] Add user authentication
- [ ] Add user profiles
- [ ] Add search functionality
- [ ] Add filters (by status, date, etc.)
- [ ] Add sorting options
- [ ] Add project categories/tags
- [ ] Add email notifications

### Performance
- [ ] Add video compression before upload
- [ ] Generate multiple video quality options
- [ ] Implement lazy loading for images
- [ ] Add service worker for offline support
- [ ] Optimize bundle size

### Developer Experience
- [ ] Add unit tests for Convex functions
- [ ] Add E2E tests with Playwright
- [ ] Set up CI/CD pipeline
- [ ] Add pre-commit hooks
- [ ] Improve TypeScript strict mode
- [ ] Add Storybook for components

## 📚 Resources

- [Project README](./README.md)
- [Quick Start Guide](./QUICKSTART.md)
- [R2 Setup Guide](./R2_SETUP_GUIDE.md)
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)
- [Convex Docs](https://docs.convex.dev)
- [TanStack Start Docs](https://tanstack.com/start)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)

## 🐛 Known Issues

None currently! If you find any, please document them here.

---

**Pro Tip**: Check off items as you complete them. Use `- [x]` to mark completed items.

**Last Updated**: October 30, 2025

