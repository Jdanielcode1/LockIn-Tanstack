# Claude Sandbox Setup - Configuration Summary

## ✅ Deployment Complete

### Cloudflare Worker
- **Worker Name**: `lock-in-claude-sandbox`
- **URL**: `https://lock-in-claude-sandbox.josedaniel-cantu.workers.dev`
- **Status**: ✅ Deployed and running
- **Version**: 1.0.0

### Environment Variables Set

#### Cloudflare Worker (Production)
```
ANTHROPIC_API_KEY=sk-ant-api03-wZBkg1Gp2GHvf...
```
Set via: `wrangler secret put ANTHROPIC_API_KEY`

#### Cloudflare Worker (Local Development)
Location: `cloudflare-claude-sandbox/.dev.vars`
```
ANTHROPIC_API_KEY=sk-ant-api03-wZBkg1Gp2GHvf...
```

#### Convex Environment
```
CLAUDE_SANDBOX_WORKER_URL=https://lock-in-claude-sandbox.josedaniel-cantu.workers.dev
ANTHROPIC_API_KEY=sk-ant-api03-wZBkg1Gp2GHvf...
```
Set via: `npx convex env set [KEY] [VALUE]`

## API Endpoints Available

### Health Check
```bash
curl https://lock-in-claude-sandbox.josedaniel-cantu.workers.dev/
```
Response:
```json
{
  "status": "ok",
  "service": "lock-in-claude-sandbox",
  "version": "1.0.0"
}
```

### Initialize Sandbox
```bash
POST https://lock-in-claude-sandbox.josedaniel-cantu.workers.dev/sandbox/:sessionId
Content-Type: application/json

{
  "repository": "https://github.com/user/repo",  # optional
  "task": "Initial task description"              # optional
}
```

### Send Command
```bash
POST https://lock-in-claude-sandbox.josedaniel-cantu.workers.dev/sandbox/:sessionId/command
Content-Type: application/json

{
  "command": "fix the bug in main.js",
  "userId": "user_id_here"
}
```

### WebSocket Connection
```
wss://lock-in-claude-sandbox.josedaniel-cantu.workers.dev/sandbox/:sessionId/ws
```

### Get Sandbox Status
```bash
GET https://lock-in-claude-sandbox.josedaniel-cantu.workers.dev/sandbox/:sessionId/status
```

### Destroy Sandbox
```bash
DELETE https://lock-in-claude-sandbox.josedaniel-cantu.workers.dev/sandbox/:sessionId
```

## Testing

To test the worker locally:
```bash
cd cloudflare-claude-sandbox
npm run dev
```

To view production logs:
```bash
cd cloudflare-claude-sandbox
npm run tail
```

## Next Steps

1. ✅ Cloudflare Worker deployed
2. ✅ Environment variables configured
3. ⏳ Build ClaudeCodePanel UI component
4. ⏳ Integrate into SessionRoomModal
5. ⏳ End-to-end testing

## Security Notes

- ✅ API key stored as Cloudflare secret (encrypted)
- ✅ `.dev.vars` added to `.gitignore`
- ✅ Each session gets isolated Durable Object instance
- ✅ Environment variables set in Convex (not exposed to client)

## Useful Commands

### Redeploy Worker
```bash
cd cloudflare-claude-sandbox
npm run deploy
```

### Update Convex Environment
```bash
npx convex env set VARIABLE_NAME "value"
```

### View Convex Environment
```bash
npx convex env get VARIABLE_NAME
```
