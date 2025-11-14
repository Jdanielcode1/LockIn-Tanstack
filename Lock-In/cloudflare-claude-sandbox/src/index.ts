/**
 * Cloudflare Worker + Sandbox for Claude Code Sessions
 *
 * This worker manages isolated Claude Code sandbox environments for Lock-In sessions.
 * Uses Cloudflare Sandbox SDK for code execution + Anthropic SDK with Claude 4.5 Haiku.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getSandbox, proxyToSandbox } from '@cloudflare/sandbox';
import Anthropic from '@anthropic-ai/sdk';

// Re-export Sandbox from SDK
export { Sandbox } from '@cloudflare/sandbox';

// Types
export interface Env {
  CLAUDE_SANDBOX: DurableObjectNamespace;
  Sandbox: DurableObjectNamespace;
  ANTHROPIC_API_KEY: string;
}

interface ClaudeMessage {
  type: 'command' | 'output' | 'error' | 'status';
  content: string;
  timestamp: number;
  userId?: string;
}

interface BashTool {
  type: 'bash';
  command: string;
}

interface ReadTool {
  type: 'read';
  path: string;
}

interface WriteTool {
  type: 'write';
  path: string;
  content: string;
}

type ToolUse = BashTool | ReadTool | WriteTool;

// Main Worker
const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Proxy preview URLs to sandbox
app.all('*', async (c, next) => {
  const proxyResponse = await proxyToSandbox(c.req.raw, c.env);
  if (proxyResponse) return proxyResponse;
  return next();
});

// Health check
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'lock-in-claude-sandbox',
    version: '3.0.0',
    features: ['cloudflare-sandbox', 'anthropic-sdk', 'claude-4.5-haiku']
  });
});

// Initialize or get sandbox for a session
app.post('/sandbox/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');
  const body = await c.req.json<{
    repository?: string;
    task?: string;
  }>();

  // Get Durable Object instance for this session
  const id = c.env.CLAUDE_SANDBOX.idFromName(sessionId);
  const stub = c.env.CLAUDE_SANDBOX.get(id);

  // Pass API key via header since DOs don't inherit secrets
  const headers = new Headers(c.req.raw.headers);
  headers.set('X-Anthropic-Api-Key', c.env.ANTHROPIC_API_KEY);

  // Create new request with body
  const request = new Request(c.req.raw.url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body)
  });

  // Initialize sandbox with repository
  const response = await stub.fetch(request);
  return response;
});

// Get sandbox status
app.get('/sandbox/:sessionId/status', async (c) => {
  const sessionId = c.req.param('sessionId');

  const id = c.env.CLAUDE_SANDBOX.idFromName(sessionId);
  const stub = c.env.CLAUDE_SANDBOX.get(id);

  const response = await stub.fetch(c.req.raw);
  return response;
});

// Send command to sandbox
app.post('/sandbox/:sessionId/command', async (c) => {
  const sessionId = c.req.param('sessionId');
  const body = await c.req.json<{
    command: string;
    userId: string;
  }>();

  const id = c.env.CLAUDE_SANDBOX.idFromName(sessionId);
  const stub = c.env.CLAUDE_SANDBOX.get(id);

  // Pass API key via header since DOs don't inherit secrets
  const headers = new Headers(c.req.raw.headers);
  headers.set('X-Anthropic-Api-Key', c.env.ANTHROPIC_API_KEY);

  // Create new request with body
  const request = new Request(c.req.raw.url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body)
  });

  const response = await stub.fetch(request);
  return response;
});

// Destroy sandbox
app.delete('/sandbox/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');

  const id = c.env.CLAUDE_SANDBOX.idFromName(sessionId);
  const stub = c.env.CLAUDE_SANDBOX.get(id);

  const response = await stub.fetch(c.req.raw);
  return response;
});

// WebSocket upgrade endpoint
app.get('/sandbox/:sessionId/ws', async (c) => {
  const sessionId = c.req.param('sessionId');

  const id = c.env.CLAUDE_SANDBOX.idFromName(sessionId);
  const stub = c.env.CLAUDE_SANDBOX.get(id);

  // Forward WebSocket upgrade to Durable Object
  return stub.fetch(c.req.raw);
});

export default app;

/**
 * Durable Object: ClaudeSandbox
 *
 * Manages a single Claude sandbox session with:
 * - Cloudflare Sandbox for code execution
 * - Anthropic SDK with Claude 4.5 Haiku
 * - WebSocket connections for real-time communication
 * - Custom tool implementation (bash, read, write)
 */
export class ClaudeSandbox implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private sessions: Set<WebSocket>;
  private commandHistory: ClaudeMessage[];
  private repository: string | null;
  private isActive: boolean;
  private sandbox: any; // Cloudflare Sandbox instance
  private workingDirectory: string;
  private apiKey: string | null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sessions = new Set();
    this.commandHistory = [];
    this.repository = null;
    this.isActive = false;
    this.sandbox = null;
    this.workingDirectory = '/workspace';
    this.apiKey = null;
  }

  private getAnthropic(): Anthropic {
    if (!this.apiKey) {
      throw new Error('API key not set. Initialize the sandbox first.');
    }
    return new Anthropic({
      apiKey: this.apiKey,
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Extract API key from header if present (always update from header)
    const apiKeyHeader = request.headers.get('X-Anthropic-Api-Key');
    if (apiKeyHeader) {
      this.apiKey = apiKeyHeader;
    }

    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    // HTTP endpoints
    if (request.method === 'POST' && path.endsWith('/command')) {
      return this.handleCommand(request);
    }

    if (request.method === 'POST') {
      return this.handleInitialize(request);
    }

    if (request.method === 'GET' && path.endsWith('/status')) {
      return this.handleStatus();
    }

    if (request.method === 'DELETE') {
      return this.handleDestroy();
    }

    return new Response('Not found', { status: 404 });
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept WebSocket connection
    server.accept();
    this.sessions.add(server);

    // Send command history to new connection
    if (this.commandHistory.length > 0) {
      server.send(JSON.stringify({
        type: 'history',
        messages: this.commandHistory
      }));
    }

    // Handle WebSocket messages
    server.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data as string);

        if (data.type === 'command') {
          await this.executeCommand(data.content, data.userId);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        server.send(JSON.stringify({
          type: 'error',
          content: 'Failed to process message',
          timestamp: Date.now()
        }));
      }
    });

    // Handle WebSocket close
    server.addEventListener('close', () => {
      this.sessions.delete(server);
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private async handleInitialize(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { repository?: string; task?: string };

      // Get Cloudflare Sandbox instance
      this.sandbox = getSandbox(this.env.Sandbox, `session-${Date.now()}`);

      // Set environment variables if needed
      if (this.apiKey) {
        await this.sandbox.setEnvVars({
          ANTHROPIC_API_KEY: this.apiKey
        });
      }

      this.repository = body.repository || null;
      this.isActive = true;

      // Set working directory
      if (this.repository) {
        this.workingDirectory = '/workspace/repo';
      }

      // If repository provided, clone it
      if (this.repository) {
        const statusMsg: ClaudeMessage = {
          type: 'status',
          content: `Cloning repository: ${this.repository}...`,
          timestamp: Date.now()
        };
        this.commandHistory.push(statusMsg);
        this.broadcast(statusMsg);

        try {
          // Use runCode for better compatibility
          const mkdirResult = await this.sandbox.runCode(
            `import subprocess; subprocess.run(['mkdir', '-p', '/workspace'], check=True)`,
            { language: 'python' }
          );

          const cloneResult = await this.sandbox.runCode(
            `import subprocess; result = subprocess.run(['git', 'clone', '${this.repository}', '/workspace/repo'], capture_output=True, text=True); print(result.stdout)`,
            { language: 'python' }
          );

          const successMsg: ClaudeMessage = {
            type: 'output',
            content: `Repository cloned successfully!\n${cloneResult.logs.stdout.join('\n')}`,
            timestamp: Date.now()
          };
          this.commandHistory.push(successMsg);
          this.broadcast(successMsg);
        } catch (error) {
          const errorMsg: ClaudeMessage = {
            type: 'error',
            content: `Failed to clone repository: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: Date.now()
          };
          this.commandHistory.push(errorMsg);
          this.broadcast(errorMsg);
        }
      }

      const message: ClaudeMessage = {
        type: 'status',
        content: `Sandbox initialized${this.repository ? ` with repository: ${this.repository}` : ''}. Ready for Claude Code commands!`,
        timestamp: Date.now()
      };

      this.commandHistory.push(message);
      this.broadcast(message);

      return new Response(JSON.stringify({
        success: true,
        repository: this.repository,
        message: 'Sandbox initialized successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleCommand(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { command: string; userId: string };
      const result = await this.executeCommand(body.command, body.userId);

      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleStatus(): Promise<Response> {
    return new Response(JSON.stringify({
      isActive: this.isActive,
      repository: this.repository,
      connections: this.sessions.size,
      commandCount: this.commandHistory.length,
      sandboxReady: !!this.sandbox,
      workingDirectory: this.workingDirectory
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleDestroy(): Promise<Response> {
    // Close all WebSocket connections
    for (const session of this.sessions) {
      session.close(1000, 'Sandbox destroyed');
    }

    this.sessions.clear();
    this.commandHistory = [];
    this.isActive = false;
    this.sandbox = null;

    return new Response(JSON.stringify({
      success: true,
      message: 'Sandbox destroyed'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async executeCommand(command: string, userId?: string): Promise<any> {
    // Add command to history
    const commandMessage: ClaudeMessage = {
      type: 'command',
      content: command,
      timestamp: Date.now(),
      userId
    };
    this.commandHistory.push(commandMessage);
    this.broadcast(commandMessage);

    if (!this.sandbox) {
      const errorMsg: ClaudeMessage = {
        type: 'error',
        content: 'Sandbox not initialized. Please initialize first.',
        timestamp: Date.now()
      };
      this.commandHistory.push(errorMsg);
      this.broadcast(errorMsg);
      return { success: false, error: errorMsg.content };
    }

    try {
      // Use Claude with custom tools
      const claudeResponse = await this.callClaudeWithTools(command);

      return {
        success: true,
        output: claudeResponse
      };
    } catch (error) {
      const errorMessage: ClaudeMessage = {
        type: 'error',
        content: error instanceof Error ? error.message : 'Command execution failed',
        timestamp: Date.now()
      };

      this.commandHistory.push(errorMessage);
      this.broadcast(errorMessage);

      return {
        success: false,
        error: errorMessage.content
      };
    }
  }

  private async callClaudeWithTools(userCommand: string): Promise<string> {
    try {
      let fullResponse = '';
      const conversationHistory: Anthropic.MessageParam[] = [];

      // Add user message
      conversationHistory.push({
        role: 'user',
        content: userCommand
      });

      // Define tools for Claude
      const tools: Anthropic.Tool[] = [
        {
          name: 'bash',
          description: 'Execute a bash command in the sandbox environment. Use this to run commands, list files, read file contents, run code, etc.',
          input_schema: {
            type: 'object',
            properties: {
              command: {
                type: 'string',
                description: 'The bash command to execute'
              }
            },
            required: ['command']
          }
        },
        {
          name: 'read_file',
          description: 'Read the contents of a file in the sandbox',
          input_schema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'The file path to read'
              }
            },
            required: ['path']
          }
        },
        {
          name: 'write_file',
          description: 'Write content to a file in the sandbox',
          input_schema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'The file path to write to'
              },
              content: {
                type: 'string',
                description: 'The content to write'
              }
            },
            required: ['path', 'content']
          }
        }
      ];

      // Call Claude with tools (max 5 iterations to prevent infinite loops)
      const anthropic = this.getAnthropic();

      for (let iteration = 0; iteration < 5; iteration++) {
        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4096,
          system: `You are Claude Code, an AI coding assistant integrated into a Lock-In session sandbox.

Current context:
- Repository: ${this.repository || 'No repository loaded'}
- Working directory: ${this.workingDirectory}
- Sandbox environment: Cloudflare Sandbox with Node.js, Python, Git, and common dev tools

You have access to a real sandbox environment where you can execute commands using the provided tools:
1. bash - Execute bash commands (ls, cat, grep, git, npm, python, etc.)
2. read_file - Read file contents
3. write_file - Write to files

When the user asks you to:
- Read/view files - Use bash or read_file tool
- Modify code - Use write_file tool and explain your changes
- Run code - Use bash tool to execute
- Debug - Use bash tool to investigate and provide solutions

Be helpful, concise, and actionable. Execute commands in the sandbox when appropriate.`,
          messages: conversationHistory,
          tools: tools
        });

        // Process response
        let hasToolUse = false;
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type === 'text') {
            fullResponse += block.text;
            const textMsg: ClaudeMessage = {
              type: 'output',
              content: block.text,
              timestamp: Date.now()
            };
            this.commandHistory.push(textMsg);
            this.broadcast(textMsg);
          } else if (block.type === 'tool_use') {
            hasToolUse = true;

            const statusMsg: ClaudeMessage = {
              type: 'status',
              content: `Executing: ${block.name}`,
              timestamp: Date.now()
            };
            this.commandHistory.push(statusMsg);
            this.broadcast(statusMsg);

            // Execute tool
            const toolResult = await this.executeTool(block.name, block.input);

            // Send result to clients
            const resultMsg: ClaudeMessage = {
              type: 'output',
              content: `Result: ${toolResult.substring(0, 1000)}${toolResult.length > 1000 ? '...' : ''}`,
              timestamp: Date.now()
            };
            this.commandHistory.push(resultMsg);
            this.broadcast(resultMsg);

            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: toolResult
            });
          }
        }

        // If no tool use, we're done
        if (!hasToolUse) {
          break;
        }

        // Add Claude's response and tool results to conversation
        conversationHistory.push({
          role: 'assistant',
          content: response.content
        });

        conversationHistory.push({
          role: 'user',
          content: toolResults
        });
      }

      return fullResponse || 'No response from Claude';
    } catch (error) {
      console.error('Error calling Claude:', error);
      throw new Error(`Claude error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeTool(toolName: string, input: any): Promise<string> {
    try {
      switch (toolName) {
        case 'bash': {
          // Use Python subprocess to run bash commands
          const code = `
import subprocess
import json

result = subprocess.run(
    ${JSON.stringify(input.command)},
    shell=True,
    capture_output=True,
    text=True,
    cwd=${JSON.stringify(this.workingDirectory)}
)

output = {
    "stdout": result.stdout,
    "stderr": result.stderr,
    "exit_code": result.returncode
}
print(json.dumps(output))
output
`;
          const result = await this.sandbox.runCode(code, { language: 'python' });

          if (result.error) {
            return `Error executing command: ${result.error.value}`;
          }

          // Parse the JSON output
          const output = result.results[0]?.text ? JSON.parse(result.results[0].text) : { stdout: '', stderr: '', exit_code: 1 };
          return `stdout:\n${output.stdout}\n\nstderr:\n${output.stderr}\n\nexit code: ${output.exit_code}`;
        }

        case 'read_file': {
          const code = `
with open(${JSON.stringify(input.path)}, 'r') as f:
    content = f.read()
content
`;
          const result = await this.sandbox.runCode(code, { language: 'python' });

          if (result.error) {
            return `Error reading file: ${result.error.value}`;
          }

          return result.results[0]?.text || '';
        }

        case 'write_file': {
          const code = `
content = ${JSON.stringify(input.content)}
with open(${JSON.stringify(input.path)}, 'w') as f:
    f.write(content)
f"File written successfully to {${JSON.stringify(input.path)}}"
`;
          const result = await this.sandbox.runCode(code, { language: 'python' });

          if (result.error) {
            return `Error writing file: ${result.error.value}`;
          }

          return result.results[0]?.text || `File written successfully to ${input.path}`;
        }

        default:
          return `Unknown tool: ${toolName}`;
      }
    } catch (error) {
      return `Tool execution error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private broadcast(message: ClaudeMessage) {
    const payload = JSON.stringify(message);
    for (const session of this.sessions) {
      try {
        session.send(payload);
      } catch (error) {
        console.error('Failed to send to WebSocket:', error);
        this.sessions.delete(session);
      }
    }
  }
}
