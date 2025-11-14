export type ClaudeMessage = {
  type: 'command' | 'output' | 'error' | 'status';
  content: string;
  timestamp: number;
  userId?: string;
  // For images - uses vision API
  imageBase64?: string;
  imageMediaType?: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  // For PDFs - uses document API
  documentBase64?: string;
  documentMediaType?: 'application/pdf';
};
