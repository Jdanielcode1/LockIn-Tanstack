import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'

interface VideoPlayerProps {
  videoKey: string
  className?: string
}

export function VideoPlayer({ videoKey, className = '' }: VideoPlayerProps) {
  const { data: videoUrl } = useSuspenseQuery(
    convexQuery(api.videos.getVideoUrl, { videoKey })
  )

  if (!videoUrl) {
    return (
      <div className={`bg-gray-900 flex items-center justify-center ${className}`}>
        <div className="text-white text-center">
          <div className="text-4xl mb-2">⚠️</div>
          <p>Video not found</p>
          <p className="text-xs text-gray-500 mt-2">Key: {videoKey}</p>
        </div>
      </div>
    )
  }

  return (
    <video
      className={`w-full ${className}`}
      controls
      src={videoUrl}
      poster="/placeholder-video.jpg"
    >
      <p className="text-white">Your browser does not support the video tag.</p>
    </video>
  )
}

