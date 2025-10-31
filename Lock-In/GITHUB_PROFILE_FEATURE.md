# GitHub-Style Profile Feature

## Overview

The app now includes a beautiful GitHub-inspired profile page at `/projects` that displays your project portfolio like a developer profile. This feature transforms your timelapse social app into a professional showcase of your work and progress.

## 🎨 Features

### 1. **Hero Section with Stats**
- **Avatar**: Large circular profile image (currently shows "TC" initials - can be customized)
- **Profile Info**: Name, bio, and status badge ("pushing to main")
- **Quick Actions**: "New Project" button prominently displayed
- **Stats Cards**: 4-card grid showing:
  - Total Projects (with active count)
  - Hours Logged (total across all projects)
  - Timelapses (with total views)
  - Completion Rate (percentage of completed projects)

### 2. **Contribution Heatmap**
A GitHub-style contribution graph showing your upload activity:
- **Year View**: Displays 365 days of activity
- **Color-Coded**: Darker green = more uploads that day
  - Gray (0 uploads)
  - Light green (1-2 uploads)
  - Medium green (3-4 uploads)
  - Dark green (5+ uploads)
- **Interactive**: Hover over any day to see exact upload count
- **Summary**: Shows total uploads for the year
- **Year Selector**: Dropdown to view previous years (future enhancement)

### 3. **Tabbed Navigation**
Three tabs organize your content:

#### **Overview Tab** (Default)
- **Pinned Projects**: Grid of 6 most recent projects (2 columns)
- **Recent Activity Feed**: Right sidebar showing chronological activity
  - Project created events 📁
  - Timelapse uploaded events 📹
  - Project completed events ✅

#### **Projects Tab**
- Full list of all projects
- Expanded cards with more details
- Shows completion progress bars
- Creation dates and statistics

#### **Activity Tab**
- Detailed activity timeline
- Full timestamps with dates and times
- Event descriptions and metadata

### 4. **GitHub-Style Project Cards**
Projects are displayed as repository-style cards:
- **Title**: Blue, clickable link
- **Status Badge**: Color-coded (active, completed, paused)
- **Description**: Short project description
- **Progress Indicator**: Orange progress dot
- **Stats**: Time logged vs target hours
- **Progress Bar**: Visual completion indicator

### 5. **Dark Theme**
Full GitHub dark mode aesthetic:
- **Background**: `bg-gray-900` (dark charcoal)
- **Cards**: `bg-gray-800` with `border-gray-700`
- **Text**: White headings, gray-400 body text
- **Accents**: Blue links, orange progress bars, green completion badges
- **Hover States**: Subtle brightening and border color changes

## 📊 Data & Analytics

### New Backend Queries (`convex/stats.ts`)

#### `getOverallStats`
Returns aggregate statistics:
```typescript
{
  totalProjects: number
  activeProjects: number
  completedProjects: number
  totalHours: number
  totalTimelapses: number
  totalViews: number
  totalLikes: number
  completionRate: number
}
```

#### `getActivityFeed`
Returns recent activity events:
```typescript
{
  id: string
  type: 'project_created' | 'timelapse_uploaded' | 'project_completed'
  projectTitle: string
  timestamp: number
  details?: string
}
```

#### `getContributionData`
Returns daily upload counts for contribution heatmap:
```typescript
{
  date: string // YYYY-MM-DD
  count: number
}
```

## 🎯 UI Components

### `ContributionHeatmap.tsx`
- Renders 52 weeks × 7 days grid
- Handles year boundaries correctly
- Interactive hover tooltips
- Color legend at bottom

### `CreateProjectModal.tsx`
- Dark-themed modal overlay
- Form with title, description, target hours
- Validation and loading states
- Error handling

## 🎨 Color Palette

### GitHub Dark Theme Colors
- **Primary Background**: `#0d1117` (gray-900)
- **Secondary Background**: `#161b22` (gray-800)
- **Border**: `#30363d` (gray-700)
- **Text Primary**: `#c9d1d9` (white/gray-100)
- **Text Secondary**: `#8b949e` (gray-400)
- **Link Blue**: `#58a6ff` (blue-400)
- **Progress Orange**: `#f97316` (orange-500)
- **Success Green**: `#3fb950` (green-500)

## 🚀 Usage

### Viewing Your Profile
1. Navigate to `/projects` in the app
2. The profile page loads with all your stats
3. Switch between tabs to see different views
4. Hover over contribution squares to see daily counts
5. Click any project card to view details

### Creating a Project
1. Click "+ New Project" button in hero section
2. Fill out the modal form:
   - Project Title (max 100 chars)
   - Description (max 500 chars)
   - Target Hours (minimum 0.5)
3. Click "Create" to save

### Navigating Projects
- Click any project card to navigate to project detail page
- Status badges show at-a-glance project state
- Progress bars indicate completion percentage

## 🔮 Future Enhancements

### Suggested Improvements
1. **Custom Avatar Upload**: Allow users to upload profile pictures
2. **Editable Bio**: Let users customize their profile description
3. **Year Selector**: Make contribution year dropdown functional
4. **Pin/Unpin Projects**: Manually select which projects appear in overview
5. **Streak Counter**: "X days in a row with uploads"
6. **Social Features**: Follow other users, see their profiles
7. **Export Stats**: Download contribution data as CSV
8. **Dark/Light Toggle**: Add theme switcher
9. **Achievements**: Badges for milestones (first upload, 100 hours, etc.)
10. **Project Tags**: Categorize projects by technology or topic

## 📝 Technical Notes

### Performance
- Uses Suspense boundaries for data fetching
- Pagination support (currently loading 100 projects)
- Efficient contribution data queries (only loads selected year)

### Routing
- Uses TanStack Router file-based routing
- Parent route (`/projects`) conditionally renders:
  - Profile page (no child route)
  - `<Outlet />` (when child route like `$projectId` is active)

### State Management
- React Query for server state
- Local state for UI (tabs, modals)
- No global state needed

### Accessibility
- Semantic HTML structure
- Color contrast meets WCAG standards
- Keyboard navigation support
- Screen reader friendly

## 🐛 Known Issues
None currently! 🎉

## 📚 Related Files
- `/src/routes/projects.tsx` - Profile page component
- `/convex/stats.ts` - Analytics backend functions
- `/src/components/ContributionHeatmap.tsx` - Heatmap visualization
- `/src/components/CreateProjectModal.tsx` - Project creation UI
- `/src/routes/__root.tsx` - Updated navbar and theme

---

**Enjoy your new GitHub-style profile! 🚀**

