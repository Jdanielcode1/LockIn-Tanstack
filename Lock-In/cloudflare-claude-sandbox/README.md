# Claude Code Sandbox Worker

Cloudflare Worker with Durable Objects for managing Claude Code sandbox sessions in Lock-In.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set your Anthropic API key as a secret:
```bash
wrangler secret put ANTHROPIC_API_KEY
# Paste your API key from https://console.anthropic.com/
```

3. Deploy to Cloudflare:
```bash
npm run deploy
```

## Development

Run locally:
```bash
npm run dev
```

View logs:
```bash
npm run tail
```

## API Endpoints

### Initialize Sandbox
```bash
POST /sandbox/:sessionId
Content-Type: application/json

{
  "repository": "https://github.com/user/repo",  # optional
  "task": "Initial task description"              # optional
}
```

### Get Sandbox Status
```bash
GET /sandbox/:sessionId/status
```

### Send Command
```bash
POST /sandbox/:sessionId/command
Content-Type: application/json

{
  "command": "fix the bug in main.js",
  "userId": "user_id_here"
}
```

### WebSocket Connection
```bash
ws://localhost:8787/sandbox/:sessionId/ws
```

Messages format:
```json
{
  "type": "command|output|error|status",
  "content": "message content",
  "timestamp": 1234567890,
  "userId": "optional_user_id"
}
```

### Destroy Sandbox
```bash
DELETE /sandbox/:sessionId
```

## Architecture

- **Worker**: Routes requests to appropriate Durable Object instances
- **Durable Object (ClaudeSandbox)**: Manages state for a single session
  - WebSocket connections for real-time communication
  - Command history and state tracking
  - Integration with Anthropic API

Each Lock-In session gets its own isolated Durable Object instance, ensuring session isolation and independent state management.
