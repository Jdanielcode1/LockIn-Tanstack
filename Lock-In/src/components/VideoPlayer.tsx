import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'

interface VideoPlayerProps {
  videoKey: string
  className?: string
}

export function VideoPlayer({ videoKey, className = '' }: VideoPlayerProps) {
  const [videoError, setVideoError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const { data: videoUrl, isLoading, error: queryError, refetch } = useQuery({
    ...convexQuery(api.r2.getVideoUrl, { videoKey }),
    retry: 3,
    retryDelay: 1000,
  })

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const video = e.currentTarget
    const error = video.error

    let errorMessage = 'Unknown video error'
    if (error) {
      switch (error.code) {
        case MediaError.MEDIA_ERR_ABORTED:
          errorMessage = 'Video playback was aborted'
          break
        case MediaError.MEDIA_ERR_NETWORK:
          errorMessage = 'Network error while loading video'
          break
        case MediaError.MEDIA_ERR_DECODE:
          errorMessage = 'Video decoding failed'
          break
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMessage = 'Video format not supported or URL expired'
          break
      }
    }

    console.error('🎥 [VideoPlayer] Video error:', {
      videoKey,
      videoUrl,
      errorCode: error?.code,
      errorMessage,
      retryCount
    })

    setVideoError(errorMessage)
  }

  const handleRetry = () => {
    console.log('🔄 [VideoPlayer] Retrying video load...', { videoKey, retryCount: retryCount + 1 })
    setVideoError(null)
    setRetryCount(prev => prev + 1)
    refetch()
  }

  if (isLoading) {
    return (
      <div className={`bg-[#0d1117] flex items-center justify-center ${className}`}>
        <div className="text-center">
          <div className="animate-spin text-4xl mb-2">⏳</div>
          <p className="text-[#8b949e]">Loading video...</p>
        </div>
      </div>
    )
  }

  if (queryError) {
    console.error('🎥 [VideoPlayer] Query error:', queryError)
    return (
      <div className={`bg-[#0d1117] flex items-center justify-center ${className}`}>
        <div className="text-center px-4">
          <div className="text-4xl mb-2">⚠️</div>
          <p className="text-red-400 mb-2">Failed to load video URL</p>
          <p className="text-xs text-[#8b949e] mb-4">Key: {videoKey}</p>
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-[#238636] hover:bg-[#2ea043] text-white rounded-md transition text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!videoUrl) {
    return (
      <div className={`bg-[#0d1117] flex items-center justify-center ${className}`}>
        <div className="text-center px-4">
          <div className="text-4xl mb-2">⚠️</div>
          <p className="text-[#c9d1d9] mb-2">Video not found</p>
          <p className="text-xs text-[#8b949e]">Key: {videoKey}</p>
        </div>
      </div>
    )
  }

  if (videoError) {
    return (
      <div className={`bg-[#0d1117] flex items-center justify-center ${className}`}>
        <div className="text-center px-4">
          <div className="text-4xl mb-2">❌</div>
          <p className="text-red-400 mb-2">Video playback failed</p>
          <p className="text-sm text-[#8b949e] mb-4">{videoError}</p>
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-[#238636] hover:bg-[#2ea043] text-white rounded-md transition text-sm"
          >
            Retry (Attempt {retryCount + 1})
          </button>
        </div>
      </div>
    )
  }

  console.log('🎥 [VideoPlayer] Rendering video:', { videoKey, videoUrl: videoUrl.substring(0, 50) + '...' })

  return (
    <video
      className={`w-full ${className}`}
      controls
      src={videoUrl}
      onError={handleVideoError}
      onLoadStart={() => console.log('🎥 [VideoPlayer] Video load started')}
      onCanPlay={() => console.log('🎥 [VideoPlayer] Video can play')}
      onLoadedMetadata={() => console.log('🎥 [VideoPlayer] Video metadata loaded')}
    >
      <p className="text-white">Your browser does not support the video tag.</p>
    </video>
  )
}

