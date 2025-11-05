type PartRequest = {
  partNumber: number;
  partStart: number;
  partEnd: number;
};

type UploadProgress = {
  loaded: number;
  total: number;
  percentage: number;
  completedParts: number;
  totalParts: number;
};

export class MultipartUploadManager {
  private file: File;
  private actorUrl: string;
  private uploadId?: string;
  private key?: string;
  private onProgress?: (progress: UploadProgress) => void;
  private completedParts = new Set<number>();
  private totalParts = 0;

  constructor(
    file: File,
    actorUrl: string,
    onProgress?: (progress: UploadProgress) => void
  ) {
    this.file = file;
    this.actorUrl = actorUrl;
    this.onProgress = onProgress;
  }

  async initialize(): Promise<{ uploadId: string; key: string }> {
    const response = await fetch(`${this.actorUrl}/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: this.file.name,
        fileSize: this.file.size,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to initialize upload: ${response.statusText}`);
    }

    const result = await response.json();
    this.uploadId = result.uploadId;
    this.key = result.key;

    return result;
  }

  async getMissingParts(): Promise<PartRequest[]> {
    const response = await fetch(`${this.actorUrl}/missing`);

    if (!response.ok) {
      throw new Error(`Failed to get missing parts: ${response.statusText}`);
    }

    const result = await response.json();
    this.totalParts = result.missingParts.length + this.completedParts.size;

    return result.missingParts;
  }

  private async uploadPart(partRequest: PartRequest): Promise<void> {
    const { partNumber, partStart, partEnd } = partRequest;

    // Extract the chunk from the file
    const chunk = this.file.slice(partStart, partEnd);

    // Upload the chunk
    const response = await fetch(`${this.actorUrl}/part/${partNumber}`, {
      method: 'PATCH',
      body: chunk,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload part ${partNumber}: ${response.statusText}`);
    }

    const result = await response.json();

    // Track completed part
    this.completedParts.add(partNumber);

    // Report progress
    if (this.onProgress) {
      const loaded = Array.from(this.completedParts).reduce((sum, pn) => {
        // Calculate approximate loaded bytes
        return sum + Math.min(10 * 1024 * 1024, this.file.size - (pn - 1) * 10 * 1024 * 1024);
      }, 0);

      this.onProgress({
        loaded,
        total: this.file.size,
        percentage: Math.round((this.completedParts.size / this.totalParts) * 100),
        completedParts: this.completedParts.size,
        totalParts: this.totalParts,
      });
    }

    return result;
  }

  async upload(concurrency: number = 5): Promise<{ key: string; etag: string }> {
    // Initialize the upload
    await this.initialize();

    // Get missing parts
    const missingParts = await this.getMissingParts();

    if (missingParts.length === 0) {
      throw new Error('No parts to upload');
    }

    // Upload parts in parallel with controlled concurrency
    const uploadPromises: Promise<void>[] = [];
    let currentIndex = 0;

    const uploadNext = async (): Promise<void> => {
      while (currentIndex < missingParts.length) {
        const partRequest = missingParts[currentIndex++];
        await this.uploadPart(partRequest);
      }
    };

    // Start concurrent upload workers
    for (let i = 0; i < Math.min(concurrency, missingParts.length); i++) {
      uploadPromises.push(uploadNext());
    }

    // Wait for all uploads to complete
    await Promise.all(uploadPromises);

    // Get final status to retrieve etag
    const statusResponse = await fetch(`${this.actorUrl}/status`);
    if (!statusResponse.ok) {
      throw new Error('Upload completed but failed to get status');
    }

    const status = await statusResponse.json();

    return {
      key: this.key!,
      etag: status.etag || '',
    };
  }

  async abort(): Promise<void> {
    await fetch(`${this.actorUrl}/abort`, {
      method: 'DELETE',
    });
  }

  async resume(): Promise<{ key: string; etag: string }> {
    // Get missing parts and continue upload
    const missingParts = await this.getMissingParts();

    if (missingParts.length === 0) {
      // Already complete
      const statusResponse = await fetch(`${this.actorUrl}/status`);
      const status = await statusResponse.json();
      return {
        key: this.key!,
        etag: status.etag || '',
      };
    }

    // Continue uploading remaining parts
    return this.upload();
  }
}

export async function uploadLargeFile(
  file: File,
  actorBaseUrl: string,
  uploaderId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<{ key: string; etag: string }> {
  const actorUrl = `${actorBaseUrl}/${uploaderId}`;
  const manager = new MultipartUploadManager(file, actorUrl, onProgress);

  try {
    return await manager.upload(5);
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}
