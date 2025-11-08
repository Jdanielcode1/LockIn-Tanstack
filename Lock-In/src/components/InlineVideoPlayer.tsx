import { useSuspenseQuery, useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'
import { useState, useRef, useEffect } from 'react'

interface InlineVideoPlayerProps {
  videoKey: string
  thumbnailKey?: string
  isPlaying: boolean
  onTogglePlay: () => void
}

export function InlineVideoPlayer({ videoKey, thumbnailKey, isPlaying, onTogglePlay }: InlineVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isBuffering, setIsBuffering] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(true)
  const [showVideo, setShowVideo] = useState(false)

  // Fetch thumbnail URL if available
  const { data: thumbnailUrl, isLoading: thumbnailLoading } = useQuery({
    ...convexQuery(api.r2.getThumbnailUrl, {
      thumbnailKey: thumbnailKey || '',
    }),
    enabled: !!thumbnailKey,
  })

  // Fetch video URL immediately to enable progressive loading
  // Browser will download first few seconds with preload="metadata"
  const shouldFetchVideo = true
  const { data: videoUrl } = useQuery({
    ...convexQuery(api.r2.getVideoUrl, { videoKey }),
    enabled: shouldFetchVideo,
  })

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        setShowVideo(true) // Load video when play is requested
        videoRef.current.play().catch(console.error)
      } else {
        videoRef.current.pause()
      }
    }
  }, [isPlaying])

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
      setIsLoading(false)
    }
  }

  const handleWaiting = () => {
    setIsBuffering(true)
  }

  const handleCanPlay = () => {
    setIsBuffering(false)
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration) return
    
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    const time = percentage * duration
    
    videoRef.current.currentTime = time
    setCurrentTime(time)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  // Show loading state while thumbnail is loading (only if we have a thumbnailKey and it's still loading)
  if (thumbnailKey && thumbnailLoading) {
    return (
      <div className="aspect-video bg-[#0d1117] flex items-center justify-center border-y border-[#30363d]">
        <div className="animate-spin text-4xl">⏳</div>
      </div>
    )
  }

  // If user clicked play but video URL isn't ready yet, show loading
  // (This should be rare since we fetch URL immediately)
  if (showVideo && !videoUrl) {
    return (
      <div className="aspect-video bg-[#0d1117] flex items-center justify-center border-y border-[#30363d]">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin text-4xl">⏳</div>
          <span className="text-xs text-[#8b949e]">Loading video...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative group bg-[#0d1117] border-y border-[#30363d]">
      {/* Render video element in background to enable preloading, but hide it until user clicks play */}
      {videoUrl && (
        <video
          ref={videoRef}
          className={`w-full aspect-video ${!showVideo ? 'hidden' : ''}`}
          src={videoUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onWaiting={handleWaiting}
          onCanPlay={handleCanPlay}
          onEnded={() => onTogglePlay()}
          muted={isMuted}
          playsInline
          preload="metadata"
        />
      )}

      {/* Show thumbnail if available and video hasn't been loaded yet */}
      {!showVideo && thumbnailUrl ? (
        <>
          <img
            src={thumbnailUrl}
            alt="Video thumbnail"
            className="w-full aspect-video object-cover"
          />
          {/* Large play button overlay on thumbnail */}
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={onTogglePlay}
              className="w-20 h-20 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-sm hover:bg-black/80 transition"
            >
              <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 16 16">
                <path d="M6.79 5.093A.5.5 0 0 0 6 5.5v5a.5.5 0 0 0 .79.407l3.5-2.5a.5.5 0 0 0 0-.814l-3.5-2.5z"/>
              </svg>
            </button>
          </div>
        </>
      ) : !showVideo && !thumbnailUrl && videoUrl ? (
        <>
          {/* No thumbnail available - show placeholder with play button while video preloads */}
          <div className="w-full aspect-video bg-gradient-to-br from-blue-500/10 to-purple-600/10 flex items-center justify-center">
            <svg className="w-16 h-16 text-[#8b949e]" fill="currentColor" viewBox="0 0 16 16">
              <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm15 0a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4z"/>
              <path d="M6.79 5.093A.5.5 0 0 0 6 5.5v5a.5.5 0 0 0 .79.407l3.5-2.5a.5.5 0 0 0 0-.814l-3.5-2.5z"/>
            </svg>
          </div>
          {/* Large play button overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={onTogglePlay}
              className="w-20 h-20 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-sm hover:bg-black/80 transition"
            >
              <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 16 16">
                <path d="M6.79 5.093A.5.5 0 0 0 6 5.5v5a.5.5 0 0 0 .79.407l3.5-2.5a.5.5 0 0 0 0-.814l-3.5-2.5z"/>
              </svg>
            </button>
          </div>
        </>
      ) : null}

      {/* Overlay Controls - shown when video is playing */}
      {showVideo && videoUrl && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {!isPlaying && !isLoading && (
              <button
                onClick={onTogglePlay}
                className="w-20 h-20 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-sm hover:bg-black/80 transition"
              >
                <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M6.79 5.093A.5.5 0 0 0 6 5.5v5a.5.5 0 0 0 .79.407l3.5-2.5a.5.5 0 0 0 0-.814l-3.5-2.5z"/>
                </svg>
              </button>
            )}

          {isPlaying && (
            <button
              onClick={onTogglePlay}
              className="w-20 h-20 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-sm hover:bg-black/80 transition opacity-0 group-hover:opacity-100"
            >
              <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 16 16">
                <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/>
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Bottom Controls Bar - only show when video is playing */}
      {showVideo && videoUrl && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Progress Bar */}
        <div
          onClick={handleSeek}
          className="w-full h-1 bg-white/30 rounded-full cursor-pointer mb-3 relative group/progress"
        >
          <div 
            className="h-full bg-[#58a6ff] rounded-full relative transition-all"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute -right-1.5 -top-0.5 w-3 h-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between text-white text-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={onTogglePlay}
              className="hover:text-[#58a6ff] transition"
            >
              {isPlaying ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M6.79 5.093A.5.5 0 0 0 6 5.5v5a.5.5 0 0 0 .79.407l3.5-2.5a.5.5 0 0 0 0-.814l-3.5-2.5z"/>
                </svg>
              )}
            </button>

            <button
              onClick={() => setIsMuted(!isMuted)}
              className="hover:text-[#58a6ff] transition"
            >
              {isMuted ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06zM9.5 8a.5.5 0 0 0-.5-.5H9a.5.5 0 0 0 0 1h.5A.5.5 0 0 0 9.5 8zm2.5 0a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0 0 1h1a.5.5 0 0 0 .5-.5zm2.5 0a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0 0 1h1a.5.5 0 0 0 .5-.5z"/>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M11.536 14.01A8.473 8.473 0 0 0 14.026 8a8.473 8.473 0 0 0-2.49-6.01l-.708.707A7.476 7.476 0 0 1 13.025 8c0 2.071-.84 3.946-2.197 5.303l.708.707z"/>
                  <path d="M10.121 12.596A6.48 6.48 0 0 0 12.025 8a6.48 6.48 0 0 0-1.904-4.596l-.707.707A5.483 5.483 0 0 1 11.025 8a5.483 5.483 0 0 1-1.61 3.89l.706.706z"/>
                  <path d="M8.707 11.182A4.486 4.486 0 0 0 10.025 8a4.486 4.486 0 0 0-1.318-3.182L8 5.525A3.489 3.489 0 0 1 9.025 8 3.49 3.49 0 0 1 8 10.475l.707.707zM6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06z"/>
                </svg>
              )}
            </button>

            <span className="text-xs">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <button
            onClick={() => {
              if (videoRef.current) {
                if (videoRef.current.requestFullscreen) {
                  videoRef.current.requestFullscreen()
                }
              }
            }}
            className="hover:text-[#58a6ff] transition"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
              <path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1h-4zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5zM.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5zm15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5z"/>
            </svg>
          </button>
        </div>
        </div>
      )}

      {/* Show buffering indicator when video is loading or buffering */}
      {(isLoading || isBuffering) && showVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0d1117]/80 z-30">
          <div className="flex flex-col items-center gap-2">
            <div className="animate-spin text-4xl">⏳</div>
            <span className="text-xs text-[#8b949e]">
              {isLoading ? 'Loading...' : 'Buffering...'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

