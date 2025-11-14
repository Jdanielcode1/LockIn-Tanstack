import type { ClaudeMessage } from '~/types/claude';

interface ClaudeMessageItemProps {
  message: ClaudeMessage;
  isCurrentUser: boolean;
}

export function ClaudeMessageItem({ message, isCurrentUser }: ClaudeMessageItemProps) {
  const formattedTime = new Date(message.timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Message styling based on type
  const getMessageStyles = () => {
    switch (message.type) {
      case 'command':
        return {
          container: 'bg-blue-600/20 border-blue-500/30',
          header: 'text-blue-400',
          content: 'text-gray-100',
          label: 'Command',
        };
      case 'output':
        return {
          container: 'bg-gray-700/40 border-gray-600/30',
          header: 'text-green-400',
          content: 'text-gray-200 font-mono text-sm',
          label: 'Claude',
        };
      case 'error':
        return {
          container: 'bg-red-600/20 border-red-500/40',
          header: 'text-red-400',
          content: 'text-red-200',
          label: 'Error',
        };
      case 'status':
        return {
          container: 'bg-gray-800/30 border-gray-700/30',
          header: 'text-gray-400',
          content: 'text-gray-400 italic',
          label: 'Status',
        };
      default:
        return {
          container: 'bg-gray-700/30 border-gray-600/30',
          header: 'text-gray-400',
          content: 'text-gray-200',
          label: 'Message',
        };
    }
  };

  const styles = getMessageStyles();

  // Format code blocks in output
  const formatContent = (content: string) => {
    // Check if content contains code blocks (```language ... ```)
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: content.slice(lastIndex, match.index),
        });
      }

      // Add code block
      parts.push({
        type: 'code',
        content: match[2].trim(),
        language: match[1] || 'text',
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({
        type: 'text',
        content: content.slice(lastIndex),
      });
    }

    // If no code blocks found, return whole content as text
    if (parts.length === 0) {
      return [{ type: 'text' as const, content }];
    }

    return parts;
  };

  const contentParts = message.type === 'output' ? formatContent(message.content) : [{ type: 'text' as const, content: message.content }];

  return (
    <div className={`border rounded-lg p-3 mb-3 ${styles.container}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-semibold ${styles.header}`}>
            {styles.label}
          </span>
          {/* Attachment indicator */}
          {(message.imageBase64 || message.documentBase64) && (
            <div className="flex items-center gap-1 text-xs text-purple-400">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span>{message.documentBase64 ? 'PDF' : 'Image'}</span>
            </div>
          )}
        </div>
        <span className="text-xs text-gray-500">{formattedTime}</span>
      </div>

      {/* Content */}
      <div className={`whitespace-pre-wrap break-words ${styles.content}`}>
        {contentParts.map((part, index) => {
          if (part.type === 'code') {
            return (
              <div key={index} className="my-2">
                <div className="text-xs text-gray-500 mb-1 font-mono">
                  {part.language}
                </div>
                <pre className="bg-black/40 rounded p-3 overflow-x-auto border border-gray-700">
                  <code className="text-sm text-gray-100">{part.content}</code>
                </pre>
              </div>
            );
          }
          return <div key={index}>{part.content}</div>;
        })}
      </div>
    </div>
  );
}
