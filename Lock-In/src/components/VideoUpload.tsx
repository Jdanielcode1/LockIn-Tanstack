import { useState } from 'react'
import { useUploadFile } from '@convex-dev/r2/react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'

interface VideoUploadProps {
  projectId: Id<'projects'>
  onComplete: () => void
  onCancel: () => void
}

export function VideoUpload({ projectId, onComplete, onCancel }: VideoUploadProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [durationMinutes, setDurationMinutes] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const uploadFile = useUploadFile(api.r2)
  const createTimelapse = useMutation(api.timelapses.create)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!videoFile) return

    setUploading(true)
    setProgress(10)

    try {
      // Upload video to R2
      setProgress(30)
      const videoKey = await uploadFile(videoFile)
      setProgress(80)

      // Create timelapse record in database
      await createTimelapse({
        projectId,
        videoKey,
        durationMinutes: parseFloat(durationMinutes),
      })

      setProgress(100)
      onComplete()
    } catch (error) {
      console.error('Upload error:', error)
      alert('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <h2 className="text-2xl font-bold mb-4">Upload Timelapse</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Video File
            </label>
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={uploading}
            />
            {videoFile && (
              <p className="text-sm text-gray-600 mt-1">
                Selected: {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration (minutes)
            </label>
            <input
              type="number"
              step="0.5"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              min="0.5"
              disabled={uploading}
              placeholder="e.g., 30"
            />
          </div>

          {uploading && (
            <div className="space-y-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 text-center">
                Uploading... {progress}%
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={uploading || !videoFile || !durationMinutes}
              className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={uploading}
              className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300 transition font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

