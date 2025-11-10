import { useState, useRef } from 'react'
import { useUploadFile } from '@convex-dev/r2/react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

interface AvatarUploadProps {
  userId: Id<'users'>
  currentAvatarKey?: string
  onUploadComplete?: () => void
}

export function AvatarUpload({ userId, currentAvatarKey, onUploadComplete }: AvatarUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadFile = useUploadFile(api.r2)
  const updateAvatar = useMutation(api.users.updateAvatar)

  const handleFileSelect = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB')
      return
    }

    setSelectedFile(file)
    
    // Create preview URL
    const reader = new FileReader()
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setUploading(true)
    setProgress(10)

    try {
      setProgress(30)

      // Upload to R2
      const avatarKey = await uploadFile(selectedFile)
      
      setProgress(70)

      // Update user record with new avatar key
      await updateAvatar({
        // userId removed - backend gets it from ctx.auth
        avatarKey
      })

      setProgress(100)

      // Clean up
      setSelectedFile(null)
      setPreviewUrl(null)
      
      if (onUploadComplete) {
        onUploadComplete()
      }

      alert('Avatar updated successfully!')
    } catch (error) {
      console.error('Avatar upload error:', error)
      alert('Failed to upload avatar. Please try again.')
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  const handleCancel = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      {/* Current/Preview Avatar */}
      <div className="flex items-center justify-center">
        <div className="relative">
          <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-[#30363d] bg-[#0d1117]">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Avatar preview"
                className="w-full h-full object-cover"
              />
            ) : currentAvatarKey ? (
              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-4xl font-bold">
                {/* Will be replaced with actual avatar from R2 */}
                ?
              </div>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center text-white text-4xl font-bold">
                +
              </div>
            )}
          </div>
          
          {!uploading && !selectedFile && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-[#238636] hover:bg-[#2ea043] text-white flex items-center justify-center transition shadow-lg"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8.5 2.687c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492V2.687zM8 1.783C7.015.936 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 0 0 0 2.5v11a.5.5 0 0 0 .707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142 2.59.087 3.223.877a.5.5 0 0 0 .78 0c.633-.790 1.814-1.019 3.222-.877 1.378.139 2.8.62 3.681 1.02A.5.5 0 0 0 16 13.5v-11a.5.5 0 0 0-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.809 8.985.936 8 1.783z"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Upload Area */}
      {!selectedFile ? (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
            dragActive
              ? 'border-[#58a6ff] bg-[#161b22]'
              : 'border-[#30363d] hover:border-[#8b949e]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleInputChange}
            className="hidden"
          />
          
          <svg className="w-12 h-12 mx-auto mb-4 text-[#8b949e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          
          <p className="text-[#c9d1d9] mb-2">
            Drag and drop your avatar here, or{' '}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-[#58a6ff] hover:underline"
            >
              browse
            </button>
          </p>
          <p className="text-xs text-[#8b949e]">
            JPG, PNG, GIF or WebP • Max 5MB
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-2">
              <div className="w-full bg-[#161b22] rounded-full h-2 border border-[#30363d]">
                <div
                  className="bg-[#238636] h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-[#8b949e] text-center">
                Uploading... {progress}%
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="flex-1 bg-[#238636] hover:bg-[#2ea043] text-white py-2 px-4 rounded-md transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : 'Upload Avatar'}
            </button>
            <button
              onClick={handleCancel}
              disabled={uploading}
              className="flex-1 bg-[#21262d] border border-[#30363d] text-[#c9d1d9] py-2 px-4 rounded-md hover:bg-[#30363d] transition font-medium disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
          
          <p className="text-xs text-[#8b949e] text-center">
            {selectedFile.name} • {(selectedFile.size / 1024).toFixed(1)} KB
          </p>
        </div>
      )}
    </div>
  )
}

