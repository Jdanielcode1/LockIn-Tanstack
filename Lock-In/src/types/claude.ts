export type ClaudeMessage = {
  type: 'command' | 'output' | 'error' | 'status';
  content: string;
  timestamp: number;
  userId?: string;
  imageBase64?: string; // Base64-encoded JPEG image for vision API
  imageMediaType?: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
};
