import { useState, useRef, useEffect } from 'react';
import { useClaudeSandbox } from '~/hooks/useClaudeSandbox';
import { ClaudeMessageItem } from './ClaudeMessageItem';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../convex/_generated/api';
import { useAction } from 'convex/react';
import type { Id } from '../../convex/_generated/dataModel';

interface ClaudeCodePanelProps {
  sessionId: Id<'lockInSessions'>;
  userId: Id<'users'>;
  isCreator: boolean;
  isModerator: boolean;
  sandboxEnabled: boolean;
  sandboxActive: boolean;
  repository?: string;
}

export function ClaudeCodePanel({
  sessionId,
  userId,
  isCreator,
  isModerator,
  sandboxEnabled,
  sandboxActive,
  repository,
}: ClaudeCodePanelProps) {
  const [commandInput, setCommandInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // WebSocket connection
  const { messages, sendCommand, isConnected, isConnecting, error, reconnect } =
    useClaudeSandbox(sessionId, userId, sandboxEnabled && sandboxActive);

  // Convex actions
  const initializeSandboxAction = useAction(api.claudeSandbox.initializeSandbox);
  const destroySandboxAction = useAction(api.claudeSandbox.destroySandbox);

  // Initialize mutation state
  const initMutation = useMutation({
    mutationFn: async () => {
      return await initializeSandboxAction({
        sessionId,
        repository: repository || undefined,
      });
    },
  });

  const destroyMutation = useMutation({
    mutationFn: async () => {
      return await destroySandboxAction({ sessionId });
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Handle command submission
  const handleSendCommand = () => {
    if (!commandInput.trim() || !isConnected) {
      return;
    }

    sendCommand(commandInput.trim());
    setCommandInput('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl + Enter to send
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSendCommand();
    }
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCommandInput(e.target.value);

    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  if (!sandboxEnabled) {
    return null;
  }

  return (
    <div className="border-t border-gray-700 bg-gray-900/50">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-purple-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
          </svg>
          <h3 className="font-semibold text-gray-200">Claude Code Assistant</h3>

          {/* Connection status */}
          <div className="flex items-center gap-1.5">
            {isConnecting && (
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
            )}
            {isConnected && (
              <div className="w-2 h-2 bg-green-500 rounded-full" />
            )}
            {!isConnecting && !isConnected && sandboxActive && (
              <div className="w-2 h-2 bg-red-500 rounded-full" />
            )}
          </div>
        </div>

        <svg
          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Panel Content */}
      {isExpanded && (
        <div className="px-4 pb-4">
          {/* Sandbox not initialized */}
          {!sandboxActive && (isCreator || isModerator) && (
            <div className="mb-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
              <p className="text-sm text-gray-300 mb-3">
                Initialize Claude Code sandbox to start collaborating with AI.
                {repository && (
                  <span className="block mt-1 text-gray-400">
                    Repository: {repository}
                  </span>
                )}
              </p>
              <button
                onClick={() => initMutation.mutate()}
                disabled={initMutation.isPending}
                className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                {initMutation.isPending ? 'Initializing...' : 'Initialize Sandbox'}
              </button>
              {initMutation.isError && (
                <p className="text-red-400 text-sm mt-2">
                  Error: {initMutation.error?.message}
                </p>
              )}
            </div>
          )}

          {!sandboxActive && !isCreator && !isModerator && (
            <div className="mb-4 p-4 bg-gray-800 rounded-lg border border-gray-700 text-center">
              <p className="text-sm text-gray-400">
                Waiting for host to initialize Claude sandbox...
              </p>
            </div>
          )}

          {/* Messages */}
          {sandboxActive && (
            <>
              <div className="mb-4 max-h-96 overflow-y-auto bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    <svg
                      className="w-12 h-12 mx-auto mb-2 opacity-50"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                      />
                    </svg>
                    <p>No messages yet. Send a command to start!</p>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <ClaudeMessageItem
                      key={`${message.timestamp}-${index}`}
                      message={message}
                      isCurrentUser={message.userId === userId}
                    />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Connection error */}
              {error && (
                <div className="mb-3 p-3 bg-red-900/20 border border-red-500/50 rounded-lg flex items-center justify-between">
                  <span className="text-red-400 text-sm">{error}</span>
                  <button
                    onClick={reconnect}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                  >
                    Reconnect
                  </button>
                </div>
              )}

              {/* Command Input */}
              <div className="space-y-2">
                <textarea
                  ref={textareaRef}
                  value={commandInput}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Claude to help with your code... (Cmd/Ctrl+Enter to send)"
                  disabled={!isConnected}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none min-h-[60px] max-h-[120px]"
                  rows={2}
                />

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500">
                    {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Disconnected'}
                  </span>

                  <div className="flex gap-2">
                    {(isCreator || isModerator) && (
                      <button
                        onClick={() => destroyMutation.mutate()}
                        disabled={destroyMutation.isPending}
                        className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 disabled:bg-gray-700 disabled:cursor-not-allowed text-red-400 text-sm rounded transition-colors"
                      >
                        {destroyMutation.isPending ? 'Stopping...' : 'Stop Sandbox'}
                      </button>
                    )}

                    <button
                      onClick={handleSendCommand}
                      disabled={!isConnected || !commandInput.trim()}
                      className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
