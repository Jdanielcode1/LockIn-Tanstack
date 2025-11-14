import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation, useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { useUser } from './UserProvider'
import { useState, useEffect, useRef } from 'react'
import { useRealtimeKitClient, RealtimeKitProvider } from '@cloudflare/realtimekit-react'
import { RtkMeeting } from '@cloudflare/realtimekit-react-ui'
import { ClaudeCodePanel } from './ClaudeCodePanel'

interface SessionRoomModalProps {
  sessionId: Id<'lockInSessions'>
  onClose: () => void
}

export function SessionRoomModal({ sessionId, onClose }: SessionRoomModalProps) {
  const { user } = useUser()
  const [isStarting, setIsStarting] = useState(false)
  const [meeting, initMeeting] = useRealtimeKitClient()
  const [openaiConnection, setOpenaiConnection] = useState<RTCPeerConnection | null>(null)
  const [aiAgentConnected, setAiAgentConnected] = useState(false)
  const openaiInitializedRef = useRef(false)
  const [copied, setCopied] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false)
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const meetingRef = useRef(meeting)
  const openaiConnectionRef = useRef(openaiConnection)

  // Fetch session details
  const { data: session } = useSuspenseQuery(
    convexQuery(api.lockInSessions.get, {
      sessionId,
    })
  )

  // Fetch participants
  const { data: participants} = useSuspenseQuery(
    convexQuery(api.lockInSessions.getParticipants, {
      sessionId,
    })
  )

  const initializeMeetingAction = useAction(api.realtimeActions.initializeMeeting)
  const addParticipantAction = useAction(api.realtimeActions.addParticipant)
  const generateOpenAITokenAction = useAction(api.openaiRealtime.generateEphemeralToken)
  const leaveMutation = useMutation(api.lockInSessions.leave)
  const endMutation = useMutation(api.lockInSessions.end)

  // For non-creators: join session and get their own auth token
  const [participantAuthToken, setParticipantAuthToken] = useState<string | null>(null)
  const [isJoining, setIsJoining] = useState(false)
  const hasAttemptedJoin = useRef(false)

  useEffect(() => {
    const isCreator = user?._id === session?.creatorId
    const isActiveSession = session?.status === 'active'
    const hasMeetingId = !!session?.realtimeKitMeetingId

    // Auto-join for non-creators when session is active
    if (!isCreator && isActiveSession && hasMeetingId && user && !participantAuthToken && !hasAttemptedJoin.current) {
      hasAttemptedJoin.current = true
      setIsJoining(true)

      const autoJoin = async () => {
        try {
          console.log('Auto-joining active session as invited participant')
          const result = await addParticipantAction({
            userId: user._id,
            sessionId,
          })

          if (result.success && result.authToken) {
            setParticipantAuthToken(result.authToken)
            console.log('Successfully joined session with own auth token')
          } else {
            console.error('Failed to join session:', result.error)
            alert(`Failed to join session: ${result.error}`)
          }
        } catch (error) {
          console.error('Error auto-joining session:', error)
          alert('Failed to join session. Please try again.')
        } finally {
          setIsJoining(false)
        }
      }

      autoJoin()
    }
  }, [session?.status, session?.creatorId, session?.realtimeKitMeetingId, user, sessionId, participantAuthToken, addParticipantAction])

  // Initialize RealtimeKit meeting
  // - Creators use the auth token from session (created when they start the meeting)
  // - Participants use their own auth token (obtained when they join)
  useEffect(() => {
    if (session?.status !== 'active' || meeting) return

    const isCreator = user?._id === session?.creatorId
    const authToken = isCreator ? session.realtimeKitAuthToken : participantAuthToken

    if (authToken) {
      console.log(`Initializing RealtimeKit meeting as ${isCreator ? 'creator' : 'participant'}`)
      initMeeting({
        authToken: authToken,
        defaults: {
          audio: true,
          video: true,
        },
      })
    }
  }, [session?.status, session?.realtimeKitAuthToken, session?.creatorId, user?._id, participantAuthToken, meeting, initMeeting])

  // Initialize OpenAI Realtime API when AI agent is enabled and session is active
  useEffect(() => {
    // Prevent re-initialization if already initialized
    if (openaiInitializedRef.current) {
      return
    }

    if (!session?.aiAgentEnabled || session.status !== 'active' || !meeting || openaiConnection || aiAgentConnected) {
      return
    }

    let pc: RTCPeerConnection | null = null

    const initializeOpenAI = async () => {
      try {
        console.log('Initializing OpenAI Realtime API for AI assistant')

        // Get ephemeral token from Convex
        const tokenResult = await generateOpenAITokenAction({ sessionId })

        if (!tokenResult.success || !tokenResult.token) {
          console.error('Failed to get OpenAI token:', tokenResult.error)
          return
        }

        // Create RTCPeerConnection
        pc = new RTCPeerConnection()

        // Create audio element to play OpenAI's voice responses
        const audioEl = document.createElement('audio')
        audioEl.autoplay = true

        // Set up audio track to receive AI voice
        pc.ontrack = (event) => {
          console.log('Received audio track from OpenAI')
          audioEl.srcObject = event.streams[0]

          // Also add AI audio to RealtimeKit meeting so other participants can hear
          if (meeting.peer) {
            const audioTrack = event.track
            meeting.peer.addTrack(audioTrack, event.streams[0])
            console.log('Added OpenAI audio track to RealtimeKit meeting')
          }
        }

        // Set up data channel for receiving OpenAI events
        const dc = pc.createDataChannel('oai-events')

        dc.addEventListener('message', (e) => {
          try {
            const event = JSON.parse(e.data)
            console.log('OpenAI event:', event)

            // Handle different event types
            switch (event.type) {
              case 'session.created':
                console.log('✅ OpenAI session created:', event.session.id)
                break
              case 'input_audio_buffer.speech_started':
                console.log('🎤 User started speaking')
                break
              case 'input_audio_buffer.speech_stopped':
                console.log('🎤 User stopped speaking')
                break
              case 'response.audio.delta':
                console.log('🤖 AI is speaking')
                break
              case 'response.done':
                console.log('✅ AI response complete')
                break
              case 'error':
                console.error('❌ OpenAI error:', event.error)
                break
            }
          } catch (error) {
            console.error('Error parsing OpenAI event:', error)
          }
        })

        dc.addEventListener('open', () => {
          console.log('✅ OpenAI data channel opened')
        })

        dc.addEventListener('error', (error) => {
          console.error('❌ OpenAI data channel error:', error)
        })

        // Get audio from existing RealtimeKit meeting
        const senders = meeting.peer?.getSenders()
        const audioSender = senders?.find(s => s.track?.kind === 'audio')

        if (audioSender && audioSender.track) {
          // Use the existing audio track from RealtimeKit
          const stream = new MediaStream([audioSender.track])
          pc.addTrack(audioSender.track, stream)
          console.log('Added RealtimeKit audio to OpenAI connection')
        } else {
          // Fallback: get new mic stream if RealtimeKit audio isn't available
          console.warn('No RealtimeKit audio found, requesting new microphone stream')
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          stream.getTracks().forEach((track) => {
            pc?.addTrack(track, stream)
          })
        }

        // Create offer and set local description
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        // Send offer to OpenAI and get answer
        const response = await fetch('https://api.openai.com/v1/realtime/calls', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokenResult.token}`,
            'Content-Type': 'application/sdp',
          },
          body: offer.sdp,
        })

        if (!response.ok) {
          throw new Error(`OpenAI connection failed: ${response.status}`)
        }

        const answerSdp = await response.text()
        await pc.setRemoteDescription({
          type: 'answer',
          sdp: answerSdp,
        })

        setOpenaiConnection(pc)
        setAiAgentConnected(true)
        openaiInitializedRef.current = true
        console.log('OpenAI Realtime API connected successfully')
      } catch (error) {
        console.error('Error initializing OpenAI:', error)
        if (pc) {
          pc.close()
        }
      }
    }

    initializeOpenAI()

    // Cleanup on unmount
    return () => {
      if (pc) {
        pc.close()
        setOpenaiConnection(null)
        setAiAgentConnected(false)
        openaiInitializedRef.current = false
      }
    }
  }, [session?.aiAgentEnabled, session?.status, meeting, sessionId])

  const handleLeave = async () => {
    if (!user) return

    try {
      // Clean up RealtimeKit meeting connection and stop all media tracks
      if (meeting) {
        // Stop all local media tracks (camera and microphone)
        if (meeting.peer) {
          meeting.peer.getSenders().forEach(sender => {
            if (sender.track) {
              sender.track.stop()
            }
          })
        }
        await meeting.leave()
      }

      // Clean up OpenAI connection if active
      if (openaiConnection) {
        openaiConnection.close()
        setOpenaiConnection(null)
        setAiAgentConnected(false)
      }

      await leaveMutation({
        // userId removed - backend gets it from ctx.auth
        sessionId,
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
      // Clean up RealtimeKit meeting connection and stop all media tracks
      if (meeting) {
        // Stop all local media tracks (camera and microphone)
        if (meeting.peer) {
          meeting.peer.getSenders().forEach(sender => {
            if (sender.track) {
              sender.track.stop()
            }
          })
        }
        await meeting.leave()
      }

      // Clean up OpenAI connection if active
      if (openaiConnection) {
        openaiConnection.close()
        setOpenaiConnection(null)
        setAiAgentConnected(false)
      }

      await endMutation({
        // userId removed - backend gets it from ctx.auth
        sessionId,
      })
      onClose()
    } catch (error) {
      console.error('Error ending session:', error)
      alert('Failed to end session')
    }
  }

  const handleStartSession = async () => {
    if (!user) return

    setIsStarting(true)
    try {
      const result = await initializeMeetingAction({
        userId: user._id,
        sessionId,
      })

      if (!result.success) {
        alert(`Failed to start session: ${result.error}`)
        setIsStarting(false)
        return
      }

      console.log('Session started successfully:', result)
      // The session data will automatically update via Convex reactivity
    } catch (error) {
      console.error('Error starting session:', error)
      alert('Failed to start session. Please try again.')
      setIsStarting(false)
    }
  }

  const handleCopyInvite = async () => {
    const inviteUrl = `${window.location.origin}/sessions/${sessionId}`

    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy invite link:', error)
      // Fallback: show the URL
      alert(`Share this link:\n${inviteUrl}`)
    }
  }

  const toggleFullscreen = async () => {
    if (!videoContainerRef.current) return

    try {
      if (!isFullscreen) {
        // Enter fullscreen
        if (videoContainerRef.current.requestFullscreen) {
          await videoContainerRef.current.requestFullscreen()
        }
        setIsFullscreen(true)
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        }
        setIsFullscreen(false)
      }
    } catch (error) {
      console.error('Fullscreen error:', error)
    }
  }

  const captureScreenshot = async () => {
    if (!meeting || !videoContainerRef.current) {
      console.error('No meeting or video container available')
      return
    }

    setIsCapturingScreenshot(true)

    try {
      console.log('Capturing screenshot of entire meeting view...')

      // Debug: Check for screen share
      const self = (meeting as any).self
      console.log('Self participant:', {
        screenShareEnabled: self.screenShareEnabled,
        screenShareTracks: self.screenShareTracks,
      })

      // Check all participants for screen shares
      const participants = (meeting as any).participants
      console.log('Participants:', participants)

      // Try to find screen share track
      let screenShareTrack = null
      if (self.screenShareEnabled && self.screenShareTracks) {
        const videoScreenTrack = self.screenShareTracks.video
        if (videoScreenTrack) {
          screenShareTrack = videoScreenTrack
          console.log('Found local screen share track')
        }
      }

      // Check if any participant is sharing screen
      if (!screenShareTrack && participants) {
        for (const participant of Object.values(participants)) {
          const p = participant as any
          if (p.screenShareEnabled && p.screenShareTracks?.video) {
            screenShareTrack = p.screenShareTracks.video
            console.log('Found screen share from participant:', p.name)
            break
          }
        }
      }

      let videoTrack = null

      // Priority: Capture screen share if available (for coding sessions)
      if (screenShareTrack) {
        console.log('Using screen share track for screenshot')
        videoTrack = screenShareTrack
      } else {
        console.log('No screen share found, capturing from camera...')
        // Fallback to camera if no screen share
        videoTrack = self.videoTrack
      }

      if (!videoTrack) {
        console.log('No camera or screen share found, capturing from rendered video container...')

        // Fallback: Try to find ANY video element in the DOM and capture it
        const videoElement = videoContainerRef.current.querySelector('video')

        if (videoElement) {
          console.log('Found video element, capturing directly from it')

          // Create canvas and capture from the video element
          const canvas = document.createElement('canvas')
          canvas.width = videoElement.videoWidth || 1280
          canvas.height = videoElement.videoHeight || 720

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            throw new Error('Could not get canvas context')
          }

          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)

          // Convert to blob
          const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (blob) => {
                if (blob) resolve(blob)
                else reject(new Error('Failed to create blob'))
              },
              'image/jpeg',
              0.9
            )
          })

          console.log('Screenshot captured from video element:', {
            width: canvas.width,
            height: canvas.height,
            size: blob.size,
          })

          // Download for testing
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `session-${sessionId}-${Date.now()}.jpg`
          a.click()
          URL.revokeObjectURL(url)

          alert('Screenshot captured successfully!')
          return
        }

        // If no video element found, use self camera as last resort
        videoTrack = self.videoTrack
        console.log('Using self camera track as fallback')
      }

      if (!videoTrack) {
        throw new Error('No video source found for screenshot')
      }

      console.log('Found video track:', {
        id: videoTrack.id,
        label: videoTrack.label,
        enabled: videoTrack.enabled,
        readyState: videoTrack.readyState,
      })

      // Create a temporary video element to render the track
      const video = document.createElement('video')
      video.autoplay = true
      video.playsInline = true
      video.muted = true

      // Set the video source to the MediaStream
      const stream = new MediaStream([videoTrack])
      video.srcObject = stream

      // Wait for video to be ready
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Video load timeout')), 5000)
        video.onloadedmetadata = () => {
          clearTimeout(timeout)
          video.play()
          // Wait a bit more for the first frame to render
          setTimeout(resolve, 100)
        }
      })

      // Create canvas and capture the frame
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 1280
      canvas.height = video.videoHeight || 720

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        throw new Error('Could not get canvas context')
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Clean up the video element
      video.srcObject = null

      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Failed to create blob'))
          },
          'image/jpeg',
          0.9
        )
      })

      console.log('Screenshot captured:', {
        width: canvas.width,
        height: canvas.height,
        size: blob.size,
      })

      // TODO: Upload to R2 and save to database
      // For now, just download for testing
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `session-${sessionId}-${Date.now()}.jpg`
      a.click()
      URL.revokeObjectURL(url)

      alert('Screenshot captured successfully!')
    } catch (error) {
      console.error('Error capturing screenshot:', error)
      alert(`Failed to capture screenshot: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsCapturingScreenshot(false)
    }
  }

  // Listen for fullscreen changes (user pressing ESC)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Keep refs updated with current values
  useEffect(() => {
    meetingRef.current = meeting
  }, [meeting])

  useEffect(() => {
    openaiConnectionRef.current = openaiConnection
  }, [openaiConnection])

  // Cleanup RealtimeKit and OpenAI connections when component unmounts
  useEffect(() => {
    return () => {
      // Cleanup RealtimeKit meeting using ref (captures latest value)
      if (meetingRef.current) {
        // Stop all local media tracks (camera and microphone)
        if (meetingRef.current.peer) {
          meetingRef.current.peer.getSenders().forEach(sender => {
            if (sender.track) {
              sender.track.stop()
            }
          })
        }
        meetingRef.current.leave().catch((err) => {
          console.error('Error leaving meeting on cleanup:', err)
        })
      }

      // Cleanup OpenAI connection using ref (captures latest value)
      if (openaiConnectionRef.current) {
        openaiConnectionRef.current.close()
      }
    }
  }, [])

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

  const isCreator = user?._id === session.creatorId
  const sessionDate = new Date(session.scheduledStartTime)
  const isActive = session.status === 'active'

  // Debug: Log Claude sandbox status
  console.log('Claude Sandbox Status:', {
    claudeSandboxEnabled: session.claudeSandboxEnabled,
    claudeSandboxActive: session.claudeSandboxActive,
    claudeRepository: session.claudeRepository,
  })

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

            {/* Video Meeting */}
            <div className="rounded-lg border border-[#30363d] bg-[#161b22] overflow-hidden relative">
              {!isActive ? (
                <div className="p-12 text-center">
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

                  {isCreator ? (
                    <>
                      <p className="text-sm text-[#8b949e] mb-4">
                        Start the session to initialize the video meeting
                      </p>
                      <button
                        onClick={handleStartSession}
                        disabled={isStarting}
                        className="px-6 py-3 bg-[#238636] text-white rounded-md hover:bg-[#2ea043] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isStarting ? 'Starting...' : 'Start Session'}
                      </button>
                    </>
                  ) : isJoining ? (
                    <>
                      <p className="text-sm text-[#8b949e] mb-4">
                        Joining session...
                      </p>
                      <div className="animate-spin text-4xl">⏳</div>
                    </>
                  ) : (
                    <p className="text-sm text-[#8b949e] mb-4">
                      Waiting for host to start the session...
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {/* Fullscreen Button */}
                  <button
                    onClick={toggleFullscreen}
                    className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-md text-white transition-colors"
                    title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  >
                    {isFullscreen ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                    )}
                  </button>
                  <div ref={videoContainerRef} style={{ height: '700px' }} className="bg-[#0d1117]">
                    {meeting ? (
                      <RealtimeKitProvider value={meeting}>
                        <RtkMeeting mode="fill" meeting={meeting} />
                      </RealtimeKitProvider>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <div className="animate-spin text-4xl mb-4">⏳</div>
                          <p className="text-[#8b949e]">Connecting to video session...</p>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={captureScreenshot}
                disabled={!isActive || isCapturingScreenshot}
                className="px-4 py-2 rounded-md border border-[#58a6ff] text-[#58a6ff] hover:bg-[#58a6ff]/10 transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCapturingScreenshot ? (
                  <>
                    <div className="animate-spin text-base">⏳</div>
                    Capturing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Capture Screenshot
                  </>
                )}
              </button>

              <div className="flex items-center gap-3">
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
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Invite Link */}
            <div className="rounded-lg border border-[#30363d] bg-[#161b22] p-4">
              <h3 className="text-sm font-semibold text-[#e6edf3] mb-3">Invite Others</h3>
              <button
                onClick={handleCopyInvite}
                className="w-full px-4 py-2 bg-[#238636] text-white rounded-md hover:bg-[#2ea043] transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                {copied ? (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy Invite Link
                  </>
                )}
              </button>
              <p className="text-xs text-[#8b949e] mt-2 text-center">
                Share this link with others to join the session
              </p>
            </div>

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
                    aiAgentConnected
                      ? 'bg-[#238636]/20 text-[#3fb950]'
                      : 'bg-[#6e7681]/20 text-[#8b949e]'
                  }`}>
                    {aiAgentConnected ? 'Connected' : 'Ready'}
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

            {/* Claude Code Assistant */}
            {session.claudeSandboxEnabled && user && (
              <div className="rounded-lg border border-[#30363d] bg-[#161b22] overflow-hidden">
                <ClaudeCodePanel
                  sessionId={sessionId}
                  userId={user._id}
                  isCreator={isCreator}
                  isModerator={false} // TODO: Add moderator support
                  sandboxEnabled={session.claudeSandboxEnabled}
                  sandboxActive={session.claudeSandboxActive || false}
                  repository={session.claudeRepository}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
