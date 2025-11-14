export type ClaudeMessage = {
  type: 'command' | 'output' | 'error' | 'status';
  content: string;
  timestamp: number;
  userId?: string;
};
