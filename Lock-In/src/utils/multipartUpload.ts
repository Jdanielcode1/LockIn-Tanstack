type UploadProgress = {
  loaded: number;
  total: number;
  percentage: number;
  completedParts: number;
  totalParts: number;
};

type UploadedPart = {
  partNumber: number;
  etag: string;
};

/**
 * Calculate optimal part size based on file size
 * Matches backend optimization strategy for consistency
 */
function calculateOptimalPartSize(fileSizeBytes: number): number {
  const fileSizeMB = fileSizeBytes / 1024 / 1024;

  // 5MB minimum for R2 (except last part)
  if (fileSizeMB < 100) {
    return 10 * 1024 * 1024; // 10MB for small files
  }

  if (fileSizeMB <= 500) {
    return 25 * 1024 * 1024; // 25MB for medium files
  }

  if (fileSizeMB <= 5000) {
    return 50 * 1024 * 1024; // 50MB for large files
  }

  return 100 * 1024 * 1024; // 100MB for very large files (5GB+)
}

/**
 * Calculate optimal concurrency based on file size and part size
 */
function calculateOptimalConcurrency(fileSize: number, partSize: number): number {
  const numParts = Math.ceil(fileSize / partSize);

  // Small files: fewer concurrent uploads to avoid overhead
  if (numParts <= 4) return 2;

  // Medium files: moderate concurrency
  if (numParts <= 20) return 4;

  // Large files: higher concurrency, but cap at 8 to avoid overwhelming browser
  return Math.min(8, Math.ceil(numParts / 10));
}

/**
 * Sleep utility for retry backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MultipartUploadManager {
  private file: File;
  private workerUrl: string;
  private key: string;
  private uploadId?: string;
  private onProgress?: (progress: UploadProgress) => void;
  private completedParts = new Map<number, string>(); // partNumber → etag
  private totalParts = 0;
  private partSize: number;
  private concurrency: number;

  constructor(file: File, workerUrl: string, onProgress?: (progress: UploadProgress) => void) {
    this.file = file;
    this.workerUrl = workerUrl;
    this.onProgress = onProgress;

    // Generate a unique key for this upload
    const timestamp = Date.now();
    this.key = `videos/${timestamp}-${file.name}`;

    // Calculate optimal part size and concurrency
    this.partSize = calculateOptimalPartSize(file.size);
    this.totalParts = Math.ceil(file.size / this.partSize);
    this.concurrency = calculateOptimalConcurrency(file.size, this.partSize);

    console.log(`Upload optimization:`, {
      fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
      partSize: `${(this.partSize / 1024 / 1024).toFixed(0)}MB`,
      totalParts: this.totalParts,
      concurrency: this.concurrency,
    });
  }

  /**
   * Create multipart upload on the worker
   */
  private async createMultipartUpload(): Promise<{ uploadId: string; key: string }> {
    const response = await fetch(`${this.workerUrl}/${this.key}?action=mpu-create`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to create multipart upload: ${response.statusText}`);
    }

    const result = await response.json();
    this.uploadId = result.uploadId;

    return result;
  }

  /**
   * Upload a single part with retry logic
   */
  private async uploadPart(partNumber: number): Promise<void> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    // Calculate part boundaries
    const start = (partNumber - 1) * this.partSize;
    const end = Math.min(start + this.partSize, this.file.size);
    const chunk = this.file.slice(start, end);

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(
          `${this.workerUrl}/${this.key}?action=mpu-uploadpart&uploadId=${this.uploadId}&partNumber=${partNumber}`,
          {
            method: 'PUT',
            body: chunk,
            keepalive: true,
            cache: 'no-store',
            signal: AbortSignal.timeout(120000), // 2 minute timeout per part
          }
        );

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        const result: UploadedPart = await response.json();

        // Store the etag for this part
        this.completedParts.set(result.partNumber, result.etag);

        // Report progress
        if (this.onProgress) {
          const loaded = this.completedParts.size * this.partSize;

          this.onProgress({
            loaded: Math.min(loaded, this.file.size),
            total: this.file.size,
            percentage: Math.round((this.completedParts.size / this.totalParts) * 100),
            completedParts: this.completedParts.size,
            totalParts: this.totalParts,
          });
        }

        return; // Success, exit retry loop
      } catch (error) {
        lastError = error as Error;
        console.warn(`Part ${partNumber} upload attempt ${attempt + 1} failed:`, error);

        if (attempt < maxRetries - 1) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt) * 1000;
          await sleep(delay);
        }
      }
    }

    throw new Error(
      `Part ${partNumber} failed after ${maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Complete the multipart upload
   */
  private async completeMultipartUpload(): Promise<{ key: string; etag: string }> {
    // Sort parts by part number and format for R2
    const parts = Array.from(this.completedParts.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([partNumber, etag]) => ({ partNumber, etag }));

    const response = await fetch(
      `${this.workerUrl}/${this.key}?action=mpu-complete&uploadId=${this.uploadId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parts }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to complete upload: ${errorText}`);
    }

    const result = await response.json();

    return {
      key: result.key,
      etag: result.etag,
    };
  }

  /**
   * Upload the file with optimized concurrency
   */
  async upload(): Promise<{ key: string; etag: string }> {
    // Step 1: Create multipart upload
    await this.createMultipartUpload();

    // Step 2: Upload all parts with controlled concurrency
    const partNumbers = Array.from({ length: this.totalParts }, (_, i) => i + 1);
    let currentIndex = 0;

    const uploadNext = async (): Promise<void> => {
      while (currentIndex < partNumbers.length) {
        const partNumber = partNumbers[currentIndex++];
        await this.uploadPart(partNumber);
      }
    };

    // Start concurrent upload workers
    const workers = Array.from({ length: Math.min(this.concurrency, this.totalParts) }, () =>
      uploadNext()
    );

    await Promise.all(workers);

    // Step 3: Complete the upload
    const result = await this.completeMultipartUpload();

    console.log(`Upload completed: ${result.key}`);

    return result;
  }

  /**
   * Abort the multipart upload
   */
  async abort(): Promise<void> {
    if (!this.uploadId) {
      return;
    }

    try {
      await fetch(
        `${this.workerUrl}/${this.key}?action=mpu-abort&uploadId=${this.uploadId}`,
        {
          method: 'DELETE',
        }
      );

      console.log(`Aborted upload: ${this.key}`);
    } catch (error) {
      console.error('Error aborting upload:', error);
    }
  }
}

/**
 * Simplified helper function for uploading large files
 */
export async function uploadLargeFile(
  file: File,
  workerUrl: string,
  uploaderId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<{ key: string; etag: string }> {
  // Note: uploaderId is no longer needed with the new stateless design,
  // but we keep it for backward compatibility
  const manager = new MultipartUploadManager(file, workerUrl, onProgress);

  try {
    return await manager.upload();
  } catch (error) {
    console.error('Upload failed:', error);
    // Attempt to abort the upload
    await manager.abort();
    throw error;
  }
}
