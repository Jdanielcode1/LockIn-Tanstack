import { useState, useRef } from 'react'
import { useUploadFile } from '@convex-dev/r2/react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { useUser } from './UserProvider'
import { uploadLargeFile } from '../utils/multipartUpload'

interface VideoUploadProps {
  projectId: Id<'projects'>
  onComplete: () => void
  onCancel: () => void
}

const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024 // 100MB
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024 // 5GB
const PROCESSING_SIZE_LIMIT = 5 * 1024 * 1024 * 1024 // 5GB - max size for timelapse processing (streaming pipeline)

export function VideoUpload({ projectId, onComplete, onCancel }: VideoUploadProps) {
  const { user } = useUser()
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [durationMinutes, setDurationMinutes] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const currentTimelapseIdRef = useRef<string | null>(null)

  // Timelapse processing state
  const [isAlreadyTimelapse, setIsAlreadyTimelapse] = useState(false)
  const [makeTimelapse, setMakeTimelapse] = useState(false)

  const uploadFile = useUploadFile(api.r2)
  const createTimelapse = useMutation(api.timelapses.create)

  // Determine if file should use multipart upload
  const isLargeFile = videoFile && videoFile.size > LARGE_FILE_THRESHOLD
  // Check if file is too large for processing
  const isTooLargeForProcessing = videoFile && videoFile.size > PROCESSING_SIZE_LIMIT

  const handleCancel = async () => {
    // Abort ongoing HTTP requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    // Cancel server-side processing if a timelapse is being processed
    if (currentTimelapseIdRef.current && makeTimelapse && !isAlreadyTimelapse) {
      const workerUrl = import.meta.env.VITE_WORKER_URL
      if (workerUrl) {
        try {
          console.log(`Cancelling server-side processing for timelapse: ${currentTimelapseIdRef.current}`)
          await fetch(`${workerUrl}/cancel/${currentTimelapseIdRef.current}`, {
            method: 'DELETE',
          })
          console.log('Successfully cancelled server-side processing')
        } catch (error) {
          console.error('Failed to cancel server-side processing:', error)
        }
      }
      currentTimelapseIdRef.current = null
    }

    setUploading(false)
    setProgress(0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!videoFile || !user) return

    // Create new AbortController for this upload
    abortControllerRef.current = new AbortController()
    setUploading(true)
    setProgress(10)

    try {
      let videoKey: string

      // Use multipart upload for large files
      if (isLargeFile) {
        setUploadStatus('Initializing multipart upload...')
        setProgress(5)

        const actorUrl = import.meta.env.VITE_UPLOAD_ACTOR_URL
        if (!actorUrl) {
          throw new Error('Upload Actor URL not configured. Please set VITE_UPLOAD_ACTOR_URL.')
        }

        // Generate unique uploader ID based on user and timestamp
        const uploaderId = `${user._id}-${Date.now()}`

        setUploadStatus('Uploading file in chunks...')
        const result = await uploadLargeFile(
          videoFile,
          actorUrl,
          uploaderId,
          (progressInfo) => {
            setProgress(Math.min(progressInfo.percentage, 90))
            setUploadStatus(
              `Uploading: ${progressInfo.completedParts}/${progressInfo.totalParts} parts (${progressInfo.percentage}%)`
            )
          }
        )

        videoKey = result.key
        setProgress(90)
        setUploadStatus('Upload complete, creating database record...')
      } else {
        // Regular upload for smaller files
        setUploadStatus('Uploading...')
        setProgress(30)
        videoKey = await uploadFile(videoFile)
        setProgress(70)
      }

      // Get video metadata (duration and dimensions)
      let originalDuration: number | undefined
      let videoWidth: number | undefined
      let videoHeight: number | undefined

      try {
        const video = document.createElement('video')
        video.preload = 'metadata'
        video.src = URL.createObjectURL(videoFile)
        await new Promise((resolve) => {
          video.onloadedmetadata = resolve
        })
        originalDuration = video.duration
        videoWidth = video.videoWidth
        videoHeight = video.videoHeight
        URL.revokeObjectURL(video.src)
      } catch (error) {
        console.error('Error getting video metadata:', error)
      }

      // Create timelapse record in database
      const shouldProcess = makeTimelapse && !isAlreadyTimelapse
      const { timelapseId } = await createTimelapse({
        // userId removed - backend gets it from ctx.auth
        projectId,
        videoKey,
        durationMinutes: parseFloat(durationMinutes),
        isTimelapse: makeTimelapse || isAlreadyTimelapse,
        originalDuration: shouldProcess ? originalDuration : undefined,
        videoWidth,
        videoHeight,
        requestProcessing: shouldProcess, // Only request processing if not already a timelapse
      })

      // Store timelapseId for cancellation
      currentTimelapseIdRef.current = timelapseId

      // If processing requested, trigger Cloudflare Worker
      if (shouldProcess) {
        const workerUrl = import.meta.env.VITE_WORKER_URL

        if (workerUrl) {
          const processUrl = `${workerUrl}/process`
          const payload = {
            videoKey,
            timelapseId,
          }

          console.log('Triggering intelligent timelapse processing:', processUrl, payload)

          // Fire and forget - processing happens in background
          fetch(processUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal: abortControllerRef.current?.signal,
          })
            .then(response => {
              console.log('Worker response status:', response.status)
              return response.json()
            })
            .then(data => {
              console.log('Worker response:', data)
            })
            .catch(err => {
              if (err.name === 'AbortError') {
                console.log('Processing request was cancelled')
              } else {
                console.error('Failed to trigger processing:', err)
              }
            })

          // Also trigger AI thumbnail generation
          const thumbnailUrl = `${workerUrl}/generate-thumbnail`
          const thumbnailPayload = {
            videoKey,
            timelapseId,
          }

          console.log('Triggering AI thumbnail generation:', thumbnailUrl, thumbnailPayload)

          fetch(thumbnailUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(thumbnailPayload),
            signal: abortControllerRef.current?.signal,
          })
            .then(response => {
              console.log('Thumbnail generation response status:', response.status)
              return response.json()
            })
            .then(data => {
              console.log('Thumbnail generation response:', data)
            })
            .catch(err => {
              if (err.name === 'AbortError') {
                console.log('Thumbnail generation request was cancelled')
              } else {
                console.error('Failed to trigger thumbnail generation:', err)
              }
            })
        } else {
          console.warn('VITE_WORKER_URL not configured - skipping server-side processing')
        }
      }

      setProgress(100)
      currentTimelapseIdRef.current = null // Clear on success
      onComplete()
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Upload was cancelled by user')
        alert('Upload cancelled')
      } else {
        console.error('Upload error:', error)
        alert('Upload failed. Please try again.')
      }
    } finally {
      setUploading(false)
      setProgress(0)
      abortControllerRef.current = null
    }
  }

  const handleFileChange = (file: File | null) => {
    if (file && file.type.startsWith('video/')) {
      if (file.size > MAX_FILE_SIZE) {
        alert(`File is too large. Maximum file size is ${MAX_FILE_SIZE / 1024 / 1024 / 1024}GB`)
        return
      }
      setVideoFile(file)
    } else if (file) {
      alert('Please select a valid video file')
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

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0])
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#161b22] border border-[#30363d] rounded-md max-w-lg w-full mx-4 shadow-2xl">
        {/* Header */}
        <div className="border-b border-[#30363d] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-[#8b949e]" fill="currentColor" viewBox="0 0 16 16">
              <path d="M1.5 3.25c0-.966.784-1.75 1.75-1.75h5.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v8.336c0 .966-.784 1.75-1.75 1.75h-8.5A1.75 1.75 0 0 1 1.5 14.5Zm1.75-.25a.25.25 0 0 0-.25.25v11.5c0 .138.112.25.25.25h8.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 7.5 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z"/>
            </svg>
            <h2 className="text-xl font-semibold text-[#c9d1d9]">Upload Timelapse</h2>
          </div>
          <button
            onClick={onCancel}
            disabled={uploading}
            className="text-[#8b949e] hover:text-[#c9d1d9] transition disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
              <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* File Upload Area */}
          <div>
            <label className="block text-sm font-medium text-[#c9d1d9] mb-2">
              Video File
            </label>
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-md transition-all ${
                dragActive
                  ? 'border-[#58a6ff] bg-[#58a6ff]/10'
                  : videoFile
                  ? 'border-[#238636] bg-[#238636]/5'
                  : 'border-[#30363d] hover:border-[#8b949e]'
              } ${uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              onClick={() => !uploading && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                className="hidden"
                required
                disabled={uploading}
              />

              <div className="p-8 text-center">
                {videoFile ? (
                  <>
                    <svg className="w-12 h-12 mx-auto mb-3 text-[#238636]" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M0 3.75C0 2.784.784 2 1.75 2h12.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0 1 14.25 14H1.75A1.75 1.75 0 0 1 0 12.25Zm1.75-.25a.25.25 0 0 0-.25.25v8.5c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25v-8.5a.25.25 0 0 0-.25-.25ZM6 10.559V5.442a.25.25 0 0 1 .379-.215l4.264 2.559a.25.25 0 0 1 0 .428l-4.264 2.559A.25.25 0 0 1 6 10.559Z"/>
                    </svg>
                    <p className="text-[#c9d1d9] font-medium mb-1">{videoFile.name}</p>
                    <p className="text-sm text-[#8b949e]">
                      {(videoFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setVideoFile(null)
                      }}
                      className="mt-3 text-sm text-[#58a6ff] hover:underline"
                    >
                      Change file
                    </button>
                  </>
                ) : (
                  <>
                    <svg className="w-12 h-12 mx-auto mb-3 text-[#8b949e]" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M2.5 3.5a.5.5 0 0 1 0-1h5.793L10 4.207V8.5a.5.5 0 0 1-1 0V5H5.5A1.5 1.5 0 0 1 4 3.5V1H2.5a.5.5 0 0 0-.5.5v12a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5V10.5a.5.5 0 0 1 1 0v3a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 1 13.5v-12A1.5 1.5 0 0 1 2.5 0h2.793L8 2.707V4.5H5.5a.5.5 0 0 1-.5-.5V1Zm8.354 9.854a.5.5 0 0 1-.708-.708l2-2a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1-.708.708L13 11.207V15.5a.5.5 0 0 1-1 0v-4.293l-1.146 1.147Z"/>
                    </svg>
                    <p className="text-[#c9d1d9] font-medium mb-1">
                      Drop your video here, or click to browse
                    </p>
                    <p className="text-sm text-[#8b949e]">
                      MP4, MOV, AVI up to 5GB
                      {isLargeFile && <span className="block text-[#58a6ff] mt-1">Large file detected - will use multipart upload</span>}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Duration Input */}
          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-[#c9d1d9] mb-2">
              Duration (minutes)
            </label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b949e]" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z"/>
              </svg>
              <input
                id="duration"
                type="number"
                step="0.5"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 bg-[#0d1117] border border-[#30363d] rounded-md text-[#c9d1d9] placeholder-[#8b949e] focus:border-[#58a6ff] focus:ring-1 focus:ring-[#58a6ff] focus:outline-none transition"
                required
                min="0.5"
                disabled={uploading}
                placeholder="e.g., 30"
              />
            </div>
            <p className="text-xs text-[#8b949e] mt-1.5">
              How long did you work on this session?
            </p>
          </div>

          {/* Timelapse Options */}
          <div className="border-t border-[#30363d] pt-5 space-y-4">
            {/* Warning for files too large for processing */}
            {isTooLargeForProcessing && !isAlreadyTimelapse && (
              <div className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767L8.982 1.566zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5zm.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"/>
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-medium text-yellow-500">File too large for processing</p>
                  <p className="text-xs text-[#8b949e] mt-1">
                    Videos over 5GB cannot be processed into timelapses. Check "This is already a timelapse" to upload as-is, or compress your video first.
                  </p>
                </div>
              </div>
            )}

            {/* Already a timelapse checkbox */}
            <div className="flex items-start gap-3">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  id="already-timelapse-checkbox"
                  checked={isAlreadyTimelapse}
                  onChange={(e) => {
                    setIsAlreadyTimelapse(e.target.checked)
                    if (e.target.checked) setMakeTimelapse(false)
                  }}
                  disabled={uploading}
                  className="peer sr-only"
                />
                <label
                  htmlFor="already-timelapse-checkbox"
                  className={`relative w-5 h-5 border-2 rounded transition-all ${
                    uploading
                      ? 'opacity-50 cursor-not-allowed'
                      : 'cursor-pointer'
                  } ${
                    isAlreadyTimelapse
                      ? 'bg-[#58a6ff] border-[#58a6ff]'
                      : 'bg-[#0d1117] border-[#30363d] hover:border-[#8b949e]'
                  }`}
                >
                  {isAlreadyTimelapse && (
                    <svg
                      className="absolute inset-0 w-5 h-5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </label>
              </div>
              <div className="flex-1">
                <label
                  htmlFor="already-timelapse-checkbox"
                  className="block text-sm font-medium text-[#c9d1d9] cursor-pointer"
                >
                  This is already a timelapse
                </label>
                <p className="text-xs text-[#8b949e] mt-1">
                  Skip processing if your video is already time-compressed. Perfect for uploads from other apps.
                </p>
              </div>
            </div>

            {/* Create timelapse checkbox - only show if not already a timelapse */}
            {!isAlreadyTimelapse && (
              <div className="flex items-start gap-3">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    id="timelapse-checkbox"
                    checked={makeTimelapse}
                    onChange={(e) => setMakeTimelapse(e.target.checked)}
                    disabled={uploading || isTooLargeForProcessing}
                    className="peer sr-only"
                  />
                  <label
                    htmlFor="timelapse-checkbox"
                    className={`relative w-5 h-5 border-2 rounded transition-all ${
                      uploading || isTooLargeForProcessing
                        ? 'opacity-50 cursor-not-allowed'
                        : 'cursor-pointer'
                    } ${
                      makeTimelapse
                        ? 'bg-[#238636] border-[#238636]'
                        : 'bg-[#0d1117] border-[#30363d] hover:border-[#8b949e]'
                    }`}
                  >
                    {makeTimelapse && (
                      <svg
                        className="absolute inset-0 w-5 h-5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </label>
                </div>
                <div className="flex-1">
                  <label
                    htmlFor="timelapse-checkbox"
                    className="block text-sm font-medium text-[#c9d1d9] cursor-pointer"
                  >
                    Create intelligent timelapse
                  </label>
                  <p className="text-xs text-[#8b949e] mt-1">
                    Automatically optimized for your video length. Short videos → 15x speed, long videos → up to 900x speed. Creates 1-3 minute watchable clips.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Upload Progress Bar */}
          {uploading && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#8b949e]">{uploadStatus || 'Uploading...'}</span>
                <span className="text-[#c9d1d9] font-medium">{progress}%</span>
              </div>
              <div className="w-full bg-[#21262d] rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#238636] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {isLargeFile && (
                <p className="text-xs text-[#8b949e]">
                  Using multipart upload for large file
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-[#30363d]">
            <button
              type="submit"
              disabled={uploading || !videoFile || !durationMinutes}
              className="flex-1 bg-[#238636] hover:bg-[#2ea043] text-white py-2.5 px-4 rounded-md transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Uploading...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M2.5 3.5a.5.5 0 0 1 0-1h5.793L10 4.207V8.5a.5.5 0 0 1-1 0V5H5.5A1.5 1.5 0 0 1 4 3.5V1H2.5a.5.5 0 0 0-.5.5v12a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5V10.5a.5.5 0 0 1 1 0v3a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 1 13.5v-12A1.5 1.5 0 0 1 2.5 0h2.793L8 2.707V4.5H5.5a.5.5 0 0 1-.5-.5V1Zm8.354 9.854a.5.5 0 0 1-.708-.708l2-2a.5.5 0 0 1 .708 0l2 2a.5.5 0 0 1-.708.708L13 11.207V15.5a.5.5 0 0 1-1 0v-4.293l-1.146 1.147Z"/>
                  </svg>
                  Upload
                </>
              )}
            </button>
            <button
              type="button"
              onClick={uploading ? handleCancel : onCancel}
              className={`flex-1 py-2.5 px-4 rounded-md transition font-medium flex items-center justify-center gap-2 ${
                uploading
                  ? 'bg-red-600/10 border border-red-600/20 text-red-400 hover:bg-red-600/20'
                  : 'bg-[#21262d] border border-[#30363d] text-[#c9d1d9] hover:bg-[#30363d]'
              }`}
            >
              {uploading ? (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854Z"/>
                  </svg>
                  Cancel Upload
                </>
              ) : (
                'Cancel'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
