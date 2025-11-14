import { useState, useEffect, useCallback, useRef } from 'react';
import type { ClaudeMessage } from '~/types/claude';

interface ClaudeSandboxHook {
  messages: ClaudeMessage[];
  sendCommand: (
    command: string,
    imageBase64?: string,
    imageMediaType?: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
    documentBase64?: string,
    documentMediaType?: 'application/pdf'
  ) => void;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  reconnect: () => void;
}

const WORKER_URL = 'https://lock-in-claude-sandbox.josedaniel-cantu.workers.dev';
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

export function useClaudeSandbox(
  sessionId: string,
  userId: string,
  enabled: boolean = true
): ClaudeSandboxHook {
  const [messages, setMessages] = useState<ClaudeMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const shouldConnectRef = useRef(enabled);

  // Update enabled ref when prop changes
  useEffect(() => {
    shouldConnectRef.current = enabled;
  }, [enabled]);

  const connect = useCallback(() => {
    if (!enabled || !sessionId || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setIsConnecting(true);
    setError(null);

    try {
      // Convert HTTP(S) URL to WS(S)
      const wsUrl = WORKER_URL.replace(/^http/, 'ws') + `/sandbox/${sessionId}/ws`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[Claude Sandbox] WebSocket connected');
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle history message (sent when first connecting)
          if (data.type === 'history' && Array.isArray(data.messages)) {
            setMessages(data.messages);
            return;
          }

          // Handle individual message
          if (data.type && data.content && data.timestamp) {
            const message: ClaudeMessage = {
              type: data.type,
              content: data.content,
              timestamp: data.timestamp,
              userId: data.userId,
            };

            setMessages((prev) => [...prev, message]);
          }
        } catch (err) {
          console.error('[Claude Sandbox] Failed to parse message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('[Claude Sandbox] WebSocket error:', event);
        setError('Connection error occurred');
      };

      ws.onclose = (event) => {
        console.log('[Claude Sandbox] WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;

        // Auto-reconnect if enabled and not max attempts
        if (
          shouldConnectRef.current &&
          reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS
        ) {
          reconnectAttemptsRef.current++;
          setError(`Reconnecting... (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_DELAY);
        } else if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setError('Failed to connect after multiple attempts');
        }
      };
    } catch (err) {
      console.error('[Claude Sandbox] Failed to create WebSocket:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setIsConnecting(false);
    }
  }, [sessionId, enabled]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const sendCommand = useCallback(
    (
      command: string,
      imageBase64?: string,
      imageMediaType?: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
      documentBase64?: string,
      documentMediaType?: 'application/pdf'
    ) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        setError('Not connected to sandbox');
        return;
      }

      if (!command.trim()) {
        return;
      }

      try {
        const message: ClaudeMessage = {
          type: 'command',
          content: command,
          userId,
          timestamp: Date.now(),
        };

        // Add image data if present
        if (imageBase64) {
          message.imageBase64 = imageBase64;
          message.imageMediaType = imageMediaType || 'image/jpeg';
        }

        // Add document data if present
        if (documentBase64) {
          message.documentBase64 = documentBase64;
          message.documentMediaType = documentMediaType || 'application/pdf';
        }

        wsRef.current.send(JSON.stringify(message));
        setError(null);
      } catch (err) {
        console.error('[Claude Sandbox] Failed to send command:', err);
        setError(err instanceof Error ? err.message : 'Failed to send command');
      }
    },
    [userId]
  );

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    disconnect();
    setTimeout(() => connect(), 100);
  }, [connect, disconnect]);

  // Connect on mount if enabled
  useEffect(() => {
    if (enabled && sessionId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [sessionId, enabled, connect, disconnect]);

  return {
    messages,
    sendCommand,
    isConnected,
    isConnecting,
    error,
    reconnect,
  };
}
