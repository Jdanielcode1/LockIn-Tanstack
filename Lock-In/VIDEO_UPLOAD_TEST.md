# Video Upload Testing Guide

The video upload functionality is fully implemented! Here's how to test it:

## ✅ What's Already Implemented

1. **Backend (Convex)**:
   - ✅ R2 component configured
   - ✅ Upload URL generation (`convex/r2.ts`)
   - ✅ Timelapse creation (`convex/timelapses.ts`)
   - ✅ Video URL retrieval for playback

2. **Frontend (React)**:
   - ✅ VideoUpload component (`src/components/VideoUpload.tsx`)
   - ✅ Upload modal in project detail page
   - ✅ Progress indicator during upload
   - ✅ Error handling

## 🧪 How to Test

### 1. Start the Development Servers

**Terminal 1 - Convex Backend:**
```bash
cd lockin-tanstack/Lock-In
npx convex dev
```

**Terminal 2 - Frontend:**
```bash
cd lockin-tanstack/Lock-In
npm run dev:web
```

Open browser to: **http://localhost:5173**

### 2. Create a Project

1. Navigate to **"Projects"** page
2. Click **"+ Create Project"**
3. Fill in:
   - Title: "Test Project"
   - Description: "Testing video upload"
   - Target Hours: 10
4. Click **"Create"**

### 3. Upload a Video

1. Click on your newly created project
2. Click **"+ Upload Timelapse"** button
3. In the modal:
   - Click **"Choose File"** and select a video file
   - Enter duration (e.g., "30" for 30 minutes)
4. Click **"Upload"**
5. Watch the progress bar (10% → 30% → 80% → 100%)

### 4. Verify Upload

After upload completes:
- ✅ Modal should close
- ✅ Video should appear in project's timelapse gallery
- ✅ Progress bar should update (completed hours increased)
- ✅ Video should appear in public feed (navigate to "Feed")

### 5. Test Video Playback

1. Click on the uploaded video (in project or feed)
2. Video player should load with controls
3. Click play to watch

## 📝 Video Upload Flow

```
User Action → VideoUpload Component → R2 Upload → Convex Database
    ↓               ↓                      ↓              ↓
Select File    useUploadFile()      Cloudflare R2    timelapses.create()
    ↓               ↓                      ↓              ↓
Enter Duration  Progress Bar        Video Stored    Project Updated
    ↓               ↓                      ↓              ↓
Click Upload    10% → 80% → 100%    Returns Key     Completed Hours++
```

## 🎬 Recommended Test Videos

For testing, use small video files first:
- **Size**: < 10 MB (for quick testing)
- **Format**: MP4 (best compatibility)
- **Duration**: 10-60 seconds

You can:
- Use your phone to record a quick video
- Download a sample video from [Sample Videos](https://sample-videos.com/)
- Use any existing video file on your computer

## 🐛 Troubleshooting

### Upload Button Disabled
- ✅ Make sure you selected a video file
- ✅ Make sure you entered a duration
- ✅ Check that R2 environment variables are set: `npx convex env list`

### Upload Fails
- Check browser console for errors (F12 → Console tab)
- Verify R2 CORS policy includes `http://localhost:5173`
- Check Convex terminal for backend errors
- Try a smaller video file first

### Video Won't Play
- R2 signed URLs expire after 24 hours
- Refresh the page to get a new URL
- Check R2 bucket in Cloudflare dashboard
- Verify video was uploaded successfully

### Progress Bar Stuck
- Check network speed (large files take time)
- Check R2 storage quota
- Look for JavaScript errors in console

## 📊 What Happens on Upload

1. **File Selection**: User picks video file from computer
2. **R2 Upload**: File uploads directly to Cloudflare R2
   - Uses `useUploadFile` hook from `@convex-dev/r2/react`
   - Generates secure upload URL
   - Uploads file in chunks
3. **Database Record**: Creates timelapse entry
   - Stores video key (R2 reference)
   - Records duration
   - Links to project
4. **Progress Update**: Project's completed hours increase
5. **UI Update**: Video appears in gallery and feed

## 🎯 Expected Behavior

### During Upload:
- Upload button becomes disabled
- Progress bar appears (animated)
- "Uploading... X%" text shows
- Cancel button becomes disabled

### After Success:
- Modal closes automatically
- Video appears in project gallery
- Progress bar on project updates
- Video is visible in public feed
- Completed hours increase by (duration / 60)

### On Error:
- Alert shows "Upload failed. Please try again."
- Modal stays open
- User can retry

## 💡 Tips

1. **First Test**: Use a very small video (< 5MB) to verify everything works
2. **Check Logs**: Watch Convex terminal for backend logs
3. **Browser DevTools**: Open Network tab to see upload progress
4. **R2 Dashboard**: Check Cloudflare R2 to see uploaded files

## 🔍 Verification Checklist

After uploading a video, verify:
- [ ] Video appears in project's timelapse section
- [ ] Project's completed hours increased correctly
- [ ] Video appears in public feed (home page)
- [ ] Can click video to view details
- [ ] Video player loads on detail page
- [ ] Like/comment features work
- [ ] View count increments when viewing

## 🚀 Next Steps

Once basic upload works, you can:
- Upload larger videos (test performance)
- Upload multiple videos to same project
- Test different video formats (MP4, MOV, WEBM)
- Try uploading from different browsers
- Test on mobile device
- Add video thumbnails
- Implement video compression before upload

---

**Need Help?** Check the browser console and Convex terminal for detailed error messages!

