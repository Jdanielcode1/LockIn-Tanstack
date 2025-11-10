import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'
import { useState, useEffect } from 'react'
import type { Id } from '../../convex/_generated/dataModel'
import { SessionRoomModal } from '../components/SessionRoomModal'
import { useUser } from '../components/UserProvider'

export const Route = createFileRoute('/_authenticated/sessions/$sessionId')({
  component: SessionDetail,
})

function SessionDetail() {
  const { sessionId } = Route.useParams()
  const { user } = useUser()
  const [showSessionModal, setShowSessionModal] = useState(false)

  console.log('🎯 SessionDetail component rendered with sessionId:', sessionId)

  const { data: session } = useSuspenseQuery(
    convexQuery(api.lockInSessions.get, { sessionId: sessionId as Id<'lockInSessions'> })
  )

  console.log('📊 Session data loaded:', session)

  // Auto-open the session modal when the page loads
  useEffect(() => {
    if (session && user) {
      setShowSessionModal(true)
    }
  }, [session, user])

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-[#c9d1d9]">
            Session not found
          </h2>
          <Link
            to="/"
            className="text-[#58a6ff] hover:underline mt-4 inline-block"
          >
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-400 border-green-500/20'
      case 'scheduled':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case 'ended':
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
      default:
        return 'bg-[#8b949e]/10 text-[#8b949e] border-[#8b949e]/20'
    }
  }

  const getSessionTypeIcon = (type: string) => {
    switch (type) {
      case 'coding':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
            <path d="M10.478 1.647a.5.5 0 1 0-.956-.294l-4 13a.5.5 0 0 0 .956.294l4-13zM4.854 4.146a.5.5 0 0 1 0 .708L1.707 8l3.147 3.146a.5.5 0 0 1-.708.708l-3.5-3.5a.5.5 0 0 1 0-.708l3.5-3.5a.5.5 0 0 1 .708 0zm6.292 0a.5.5 0 0 0 0 .708L14.293 8l-3.147 3.146a.5.5 0 0 0 .708.708l3.5-3.5a.5.5 0 0 0 0-.708l-3.5-3.5a.5.5 0 0 0-.708 0z"/>
          </svg>
        )
      case 'study':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8.211 2.047a.5.5 0 0 0-.422 0l-7.5 3.5a.5.5 0 0 0 .025.917l7.5 3a.5.5 0 0 0 .372 0L14 7.14V13a1 1 0 0 0-1 1v2h3v-2a1 1 0 0 0-1-1V6.739l.686-.275a.5.5 0 0 0 .025-.917l-7.5-3.5ZM8 8.46 1.758 5.965 8 3.052l6.242 2.913L8 8.46Z"/>
            <path d="M4.176 9.032a.5.5 0 0 0-.656.327l-.5 1.7a.5.5 0 0 0 .294.605l4.5 1.8a.5.5 0 0 0 .372 0l4.5-1.8a.5.5 0 0 0 .294-.605l-.5-1.7a.5.5 0 0 0-.656-.327L8 10.466 4.176 9.032Z"/>
          </svg>
        )
      default:
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
            <path d="M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2zM8 1.918l-.797.161A4.002 4.002 0 0 0 4 6c0 .628-.134 2.197-.459 3.742-.16.767-.376 1.566-.663 2.258h10.244c-.287-.692-.502-1.49-.663-2.258C12.134 8.197 12 6.628 12 6a4.002 4.002 0 0 0-3.203-3.92L8 1.917zM14.22 12c.223.447.481.801.78 1H1c.299-.199.557-.553.78-1C2.68 10.2 3 6.88 3 6c0-2.42 1.72-4.44 4.005-4.901a1 1 0 1 1 1.99 0A5.002 5.002 0 0 1 13 6c0 .88.32 4.2 1.22 6z"/>
          </svg>
        )
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <main className="min-h-screen bg-[#0d1117]">
      <div className="container mx-auto px-4 py-8 max-w-[1280px]">
        <Link
          to="/"
          className="text-[#58a6ff] hover:underline mb-6 inline-flex items-center gap-2 text-sm"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
            <path fillRule="evenodd" d="M7.78 12.53a.75.75 0 0 1-1.06 0L2.47 8.28a.75.75 0 0 1 0-1.06l4.25-4.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L4.81 7h7.44a.75.75 0 0 1 0 1.5H4.81l2.97 2.97a.75.75 0 0 1 0 1.06Z"/>
          </svg>
          Back to Home
        </Link>

        <div className="bg-[#161b22] border border-[#30363d] rounded-md p-8 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-3xl font-bold text-[#c9d1d9]">
                  {session.title}
                </h1>
                <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusBadge(session.status)}`}>
                  {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                </span>
              </div>
              <p className="text-[#8b949e] text-base mb-3">{session.description}</p>
              <div className="flex flex-wrap items-center gap-4 text-sm text-[#8b949e]">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/>
                    <path d="M8 3.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM6.5 8a.5.5 0 0 1 .5-.5h1.5a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5H7a.5.5 0 0 1-.5-.5V8Z"/>
                  </svg>
                  <span>Created by <span className="text-[#c9d1d9] font-medium">{session.creator.displayName}</span></span>
                </div>
                <div className="flex items-center gap-2">
                  {getSessionTypeIcon(session.sessionType)}
                  <span className="text-[#c9d1d9] font-medium capitalize">{session.sessionType}</span>
                </div>
                {session.projectTitle && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M9.828 3h3.982a2 2 0 0 1 1.992 2.181l-.637 7A2 2 0 0 1 13.174 14H2.825a2 2 0 0 1-1.991-1.819l-.637-7a1.99 1.99 0 0 1 .342-1.31L.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3zm-8.322.12C1.72 3.042 1.95 3 2.19 3h5.396l-.707-.707A1 1 0 0 0 6.172 2H2.5a1 1 0 0 0-1 .981l.006.139z"/>
                    </svg>
                    <span className="text-[#c9d1d9] font-medium">{session.projectTitle}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-[#30363d]">
            <div>
              <p className="text-sm text-[#8b949e] mb-1 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z"/>
                </svg>
                Scheduled Time
              </p>
              <p className="text-base font-medium text-[#c9d1d9]">{formatDate(session.scheduledStartTime)}</p>
            </div>
            <div>
              <p className="text-sm text-[#8b949e] mb-1 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1H7Zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5.784 6A2.238 2.238 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.325 6.325 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1h4.216ZM4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/>
                </svg>
                Max Participants
              </p>
              <p className="text-base font-medium text-[#c9d1d9]">{session.maxParticipants}</p>
            </div>
            <div>
              <p className="text-sm text-[#8b949e] mb-1 flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
                  <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319z"/>
                </svg>
                AI Assistant
              </p>
              <p className="text-base font-medium text-[#c9d1d9]">
                {session.aiAgentEnabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
          </div>

          {user && (
            <div className="mt-6 pt-6 border-t border-[#30363d]">
              <button
                onClick={() => setShowSessionModal(true)}
                disabled={session.status === 'ended'}
                className={`w-full px-6 py-3 rounded-md transition font-medium text-base flex items-center justify-center gap-2 ${
                  session.status === 'ended'
                    ? 'bg-[#21262d] text-[#8b949e] cursor-not-allowed'
                    : 'bg-[#238636] hover:bg-[#2ea043] text-white'
                }`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm15 0a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4z"/>
                  <path d="M6.79 5.093A.5.5 0 0 0 6 5.5v5a.5.5 0 0 0 .79.407l3.5-2.5a.5.5 0 0 0 0-.814l-3.5-2.5z"/>
                </svg>
                {session.status === 'ended' ? 'Session Ended' : 'Join Session'}
              </button>
            </div>
          )}

          {!user && (
            <div className="mt-6 pt-6 border-t border-[#30363d]">
              <div className="text-center">
                <p className="text-[#8b949e] mb-4">You need to be logged in to join this session</p>
                <Link
                  to="/"
                  className="inline-block px-6 py-3 bg-[#238636] hover:bg-[#2ea043] text-white rounded-md transition font-medium"
                >
                  Go to Home
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {showSessionModal && user && (
        <SessionRoomModal
          sessionId={sessionId as Id<'lockInSessions'>}
          onClose={() => setShowSessionModal(false)}
        />
      )}
    </main>
  )
}
