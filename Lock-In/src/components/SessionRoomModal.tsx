import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { useUser } from './UserProvider'

interface SessionRoomModalProps {
  sessionId: Id<'lockInSessions'>
  onClose: () => void
}

export function SessionRoomModal({ sessionId, onClose }: SessionRoomModalProps) {
  const { user } = useUser()

  // Fetch session details
  const { data: session } = useSuspenseQuery(
    convexQuery(api.lockInSessions.get, {
      sessionId,
    })
  )

  // Fetch participants
  const { data: participants } = useSuspenseQuery(
    convexQuery(api.lockInSessions.getParticipants, {
      sessionId,
    })
  )

  const leaveMutation = useMutation(api.lockInSessions.leave)
  const endMutation = useMutation(api.lockInSessions.end)

  const handleLeave = async () => {
    if (!user) return

    try {
      await leaveMutation({
        sessionId,
        userId: user.userId,
      })
      onClose()
    } catch (error) {
      console.error('Error leaving session:', error)
      alert('Failed to leave session')
    }
  }

  const handleEnd = async () => {
    if (!user || !confirm('Are you sure you want to end this session for everyone?')) return

    try {
      await endMutation({
        sessionId,
        userId: user.userId,
      })
      onClose()
    } catch (error) {
      console.error('Error ending session:', error)
      alert('Failed to end session')
    }
  }

  if (!session) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-8 text-center">
          <h2 className="text-xl font-semibold text-[#e6edf3] mb-4">Session not found</h2>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#238636] text-white rounded-md hover:bg-[#2ea043]"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  const isCreator = user?.userId === session.creatorId
  const sessionDate = new Date(session.scheduledStartTime)
  const isActive = session.status === 'active'

  return (
    <div className="fixed inset-0 z-50 bg-[#0d1117] overflow-y-auto">
      {/* Header */}
      <div className="border-b border-[#30363d] bg-[#161b22] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#e6edf3]">{session.title}</h1>
              <p className="text-sm text-[#8b949e] mt-1">
                {sessionDate.toLocaleString()} • {session.sessionType} session
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-[#8b949e] hover:text-[#e6edf3] transition-colors"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Session Info */}
            <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[#e6edf3]">About this session</h2>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    isActive
                      ? 'bg-[#238636]/20 text-[#3fb950]'
                      : session.status === 'scheduled'
                      ? 'bg-[#58a6ff]/20 text-[#58a6ff]'
                      : 'bg-[#6e7681]/20 text-[#8b949e]'
                  }`}
                >
                  {session.status}
                </span>
              </div>
              <p className="text-[#8b949e] whitespace-pre-wrap">{session.description}</p>

              {session.aiAgentEnabled && (
                <div className="mt-4 flex items-center gap-2 text-sm text-[#58a6ff]">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                  AI Assistant enabled - Say "hey agent" for help
                </div>
              )}
            </div>

            {/* Video Meeting Placeholder */}
            <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-12">
              <div className="text-center">
                <svg
                  className="h-16 w-16 mx-auto text-[#8b949e] mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <h3 className="text-lg font-medium text-[#e6edf3] mb-2">
                  Video Meeting
                </h3>
                <p className="text-sm text-[#8b949e] mb-4">
                  RealtimeKit video integration ready to implement
                </p>
                <div className="bg-[#0d1117] border border-[#30363d] rounded-md p-4 text-left max-w-md mx-auto">
                  <p className="text-xs text-[#6e7681] mb-2">Next Steps:</p>
                  <ul className="text-xs text-[#8b949e] space-y-1">
                    <li>• Initialize RealtimeKit meeting on session start</li>
                    <li>• Integrate WebRTC video/audio streams</li>
                    <li>• Connect AI agent to meeting audio</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={handleLeave}
                className="px-4 py-2 rounded-md border border-[#f85149] text-[#f85149] hover:bg-[#f85149]/10 transition-colors text-sm font-medium"
              >
                Leave Session
              </button>
              {isCreator && (
                <button
                  onClick={handleEnd}
                  className="px-4 py-2 rounded-md bg-[#da3633] text-white hover:bg-[#f85149] transition-colors text-sm font-medium"
                >
                  End Session
                </button>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Participants */}
            <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
              <h3 className="text-sm font-semibold text-[#e6edf3] mb-3">
                Participants ({participants.length}/{session.maxParticipants})
              </h3>
              <div className="space-y-2">
                {participants.map((participant) => (
                  <div
                    key={participant._id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-[#21262d] transition-colors"
                  >
                    <div className="h-8 w-8 rounded-full bg-[#21262d] flex items-center justify-center text-[#e6edf3] font-medium text-sm">
                      {participant.user.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#e6edf3] truncate">
                        {participant.user.username}
                        {participant.userId === session.creatorId && (
                          <span className="ml-2 text-xs text-[#8b949e]">(host)</span>
                        )}
                      </div>
                      <div className="text-xs text-[#8b949e]">
                        {participant.isActive ? (
                          <span className="flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-full bg-[#3fb950]"></span>
                            Active
                          </span>
                        ) : (
                          'Joined'
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Session Details */}
            <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
              <h3 className="text-sm font-semibold text-[#e6edf3] mb-3">Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#8b949e]">Host</span>
                  <span className="text-[#e6edf3]">{session.creator.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8b949e]">Type</span>
                  <span className="text-[#e6edf3] capitalize">{session.sessionType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8b949e]">Scheduled</span>
                  <span className="text-[#e6edf3]">
                    {sessionDate.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8b949e]">Max participants</span>
                  <span className="text-[#e6edf3]">{session.maxParticipants}</span>
                </div>
                {session.projectTitle && (
                  <div className="pt-2 border-t border-[#30363d]">
                    <div className="text-[#8b949e] mb-1">Project</div>
                    <div className="text-[#e6edf3] font-medium">{session.projectTitle}</div>
                  </div>
                )}
              </div>
            </div>

            {/* AI Agent Status */}
            {session.aiAgentEnabled && (
              <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[#e6edf3]">AI Assistant</h3>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    session.aiAgentActive
                      ? 'bg-[#238636]/20 text-[#3fb950]'
                      : 'bg-[#6e7681]/20 text-[#8b949e]'
                  }`}>
                    {session.aiAgentActive ? 'Active' : 'Ready'}
                  </span>
                </div>
                <p className="text-xs text-[#8b949e] mb-3">
                  Say "hey agent" followed by your question to get coding help
                </p>
                <div className="bg-[#0d1117] border border-[#30363d] rounded-md p-3 text-xs text-[#8b949e]">
                  <div className="font-medium text-[#e6edf3] mb-1">Example commands:</div>
                  <ul className="space-y-1">
                    <li>• "Hey agent, how do I fix this error?"</li>
                    <li>• "Hey agent, explain this function"</li>
                    <li>• "Hey agent, give me a tip"</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
