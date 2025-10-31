import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { AvatarUpload } from './AvatarUpload'

interface UserProfileEditProps {
  userId: Id<'users'>
  onClose: () => void
}

export function UserProfileEdit({ userId, onClose }: UserProfileEditProps) {
  const user = useQuery(api.users.getUser, { userId })
  const updateProfile = useMutation(api.users.updateProfile)
  
  const [displayName, setDisplayName] = useState(user?.displayName || '')
  const [bio, setBio] = useState(user?.bio || '')
  const [email, setEmail] = useState(user?.email || '')
  const [location, setLocation] = useState(user?.location || '')
  const [saving, setSaving] = useState(false)

  // Update form when user data loads
  if (user && displayName === '' && user.displayName) {
    setDisplayName(user.displayName)
    setBio(user.bio || '')
    setEmail(user.email || '')
    setLocation(user.location || '')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!displayName.trim()) {
      alert('Display name is required')
      return
    }

    setSaving(true)
    try {
      await updateProfile({
        userId,
        displayName: displayName.trim(),
        bio: bio.trim() || undefined,
        email: email.trim() || undefined,
        location: location.trim() || undefined,
      })
      
      alert('Profile updated successfully!')
      onClose()
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('Failed to update profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-[#161b22] rounded-lg p-8 max-w-2xl w-full mx-4">
          <div className="text-center text-[#8b949e]">
            <div className="animate-spin text-4xl mb-4">⏳</div>
            <p>Loading profile...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-[#161b22] rounded-lg max-w-2xl w-full mx-4 my-8 border border-[#30363d]">
        {/* Header */}
        <div className="border-b border-[#30363d] px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[#c9d1d9]">Edit Profile</h2>
          <button
            onClick={onClose}
            className="text-[#8b949e] hover:text-[#c9d1d9] transition"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 16 16">
              <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Avatar Section */}
          <div>
            <label className="block text-sm font-medium text-[#c9d1d9] mb-3">
              Avatar
            </label>
            <AvatarUpload
              userId={userId}
              currentAvatarKey={user.avatarKey}
              onUploadComplete={() => {
                // Avatar upload component handles the update
                console.log('Avatar uploaded')
              }}
            />
          </div>

          {/* Username (Read-only) */}
          <div>
            <label className="block text-sm font-medium text-[#c9d1d9] mb-2">
              Username
            </label>
            <div className="bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-[#8b949e] cursor-not-allowed">
              @{user.username}
            </div>
            <p className="text-xs text-[#8b949e] mt-1">
              Username cannot be changed
            </p>
          </div>

          {/* Display Name */}
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-[#c9d1d9] mb-2">
              Display Name <span className="text-[#f85149]">*</span>
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              required
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-[#c9d1d9] placeholder-[#8b949e] focus:border-[#58a6ff] focus:outline-none"
              placeholder="Your display name"
            />
            <p className="text-xs text-[#8b949e] mt-1">
              {displayName.length}/50 characters
            </p>
          </div>

          {/* Bio */}
          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-[#c9d1d9] mb-2">
              Bio
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              maxLength={200}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-[#c9d1d9] placeholder-[#8b949e] focus:border-[#58a6ff] focus:outline-none resize-none"
              placeholder="Tell us about yourself..."
            />
            <p className="text-xs text-[#8b949e] mt-1">
              {bio.length}/200 characters
            </p>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[#c9d1d9] mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-[#c9d1d9] placeholder-[#8b949e] focus:border-[#58a6ff] focus:outline-none"
              placeholder="your.email@example.com"
            />
          </div>

          {/* Location */}
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-[#c9d1d9] mb-2">
              Location
            </label>
            <input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={50}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-md px-3 py-2 text-[#c9d1d9] placeholder-[#8b949e] focus:border-[#58a6ff] focus:outline-none"
              placeholder="San Francisco, CA"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-[#30363d]">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-[#238636] hover:bg-[#2ea043] text-white py-2 px-4 rounded-md transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 bg-[#21262d] border border-[#30363d] text-[#c9d1d9] py-2 px-4 rounded-md hover:bg-[#30363d] transition font-medium disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

