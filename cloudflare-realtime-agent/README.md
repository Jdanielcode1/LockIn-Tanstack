# Lock In Realtime AI Agent

AI-powered coding assistant for Lock In Sessions using Cloudflare Realtime Agents.

## Features

- **Voice-activated AI assistant** - Say "hey agent" to get coding help
- **Context-aware responses** - Knows your project and session type
- **Speech-to-text** - Powered by Deepgram
- **Text-to-speech** - Powered by ElevenLabs
- **AI inference** - Powered by Workers AI (Llama 3.1)
- **Automatic logging** - All interactions saved to Convex

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set environment variables

You need to set these secrets using Wrangler:

```bash
# Cloudflare credentials
npx wrangler secret put ACCOUNT_ID
# Enter your Cloudflare account ID

npx wrangler secret put API_TOKEN
# Enter a Cloudflare API token with Realtime Admin access

# Deepgram API key (for speech-to-text)
npx wrangler secret put DEEPGRAM_API_KEY
# Get from: https://console.deepgram.com/

# ElevenLabs API key (for text-to-speech)
npx wrangler secret put ELEVENLABS_API_KEY
# Get from: https://elevenlabs.io/

# Convex backend URL
npx wrangler secret put CONVEX_URL
# Example: https://your-deployment.convex.cloud
```

### 3. Deploy

```bash
npm run deploy
```

## Development

```bash
# Run locally
npm run dev

# Watch logs
npm run tail
```

## How it works

1. **User joins session** → Frontend calls `/init` endpoint
2. **Agent joins meeting** → Connects to RealtimeKit meeting via WebRTC
3. **User speaks** → Audio → Deepgram STT → Text transcript
4. **AI processes** → Detects "hey agent" keywords → Sends to Workers AI
5. **AI responds** → Text response → ElevenLabs TTS → Audio
6. **Logging** → Interaction saved to Convex for analysis

## API Endpoints

### POST `/init?sessionId=<id>`

Initialize AI agent for a session.

**Request body:**
```json
{
  "meetingId": "rtk-meeting-id",
  "authToken": "rtk-auth-token",
  "userId": "user-id",
  "projectTitle": "My Project",
  "sessionType": "coding" | "study" | "general"
}
```

### POST `/deinit?sessionId=<id>`

Stop AI agent for a session.

### GET `/health`

Health check endpoint.

## Agent Capabilities

The AI assistant can:
- Answer coding questions
- Help debug issues
- Provide best practices
- Give motivational support
- Ask clarifying questions

**Activation keywords:**
- "hey agent"
- "help"
- "stuck"
- "how do i"
- "can you help"
- "explain"
- "debug"

## Architecture

```
User Voice
    ↓
RealtimeKit (WebRTC)
    ↓
Deepgram STT
    ↓
CodingAssistantProcessor
    ↓
Workers AI (Llama 3.1)
    ↓
ElevenLabs TTS
    ↓
RealtimeKit (WebRTC)
    ↓
User Hears Response
```

## Logs

All AI interactions are automatically logged to Convex:
- Question asked
- AI response
- Timestamp
- User ID
- Session ID

Users can rate responses as helpful/not helpful for continuous improvement.
