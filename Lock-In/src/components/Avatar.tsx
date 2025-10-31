import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'

interface AvatarProps {
  avatarKey?: string
  displayName: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-16 h-16 text-2xl',
  xl: 'w-24 h-24 text-4xl',
}

export function Avatar({ avatarKey, displayName, size = 'md', className = '' }: AvatarProps) {
  const initials = displayName
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Random color based on display name for consistency
  const colors = [
    'from-blue-500 to-purple-600',
    'from-green-500 to-blue-600',
    'from-orange-500 to-pink-600',
    'from-purple-500 to-indigo-600',
    'from-yellow-500 to-red-600',
    'from-teal-500 to-cyan-600',
  ]
  
  const colorIndex = displayName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length
  const gradient = colors[colorIndex]

  if (!avatarKey) {
    return (
      <div
        className={`${sizeClasses[size]} ${className} rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold flex-shrink-0`}
      >
        {initials}
      </div>
    )
  }

  return (
    <AvatarWithUrl
      avatarKey={avatarKey}
      displayName={displayName}
      size={size}
      className={className}
      gradient={gradient}
      initials={initials}
    />
  )
}

interface AvatarWithUrlProps extends AvatarProps {
  avatarKey: string
  gradient: string
  initials: string
}

function AvatarWithUrl({ avatarKey, displayName, size = 'md', className = '', gradient, initials }: AvatarWithUrlProps) {
  const { data: avatarUrl } = useSuspenseQuery(
    convexQuery(api.r2.getAvatarUrl, { avatarKey })
  )

  if (!avatarUrl) {
    return (
      <div
        className={`${sizeClasses[size]} ${className} rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold flex-shrink-0`}
      >
        {initials}
      </div>
    )
  }

  return (
    <img
      src={avatarUrl}
      alt={`${displayName}'s avatar`}
      className={`${sizeClasses[size]} ${className} rounded-full object-cover flex-shrink-0 border-2 border-[#30363d]`}
    />
  )
}

