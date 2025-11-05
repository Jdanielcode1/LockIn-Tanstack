import { Actor, Persist, handler } from '@cloudflare/actors';

interface Env {
  R2_BUCKET: R2Bucket;
  UPLOADER: DurableObjectNamespace;
}

type PartRequest = {
  partNumber: number;
  partStart: number;
  partEnd: number;
};

type Part = {
  part_number: number;
  part_start: number;
  part_end: number;
  r2_uploaded_part: string;
  completed: boolean;
};

const PART_SIZE = 10 * 1024 * 1024; // 10MB per part

export class Uploader extends Actor<Env> {
  @Persist
  originalFileName?: string;

  @Persist
  fileSize?: number;

  @Persist
  key?: string;

  @Persist
  multiPartUploadId?: string;

  // Cached multipart upload instance (not persisted, recreated on init)
  _multiPartUpload?: R2MultipartUpload;

  async onInit() {
    // Set up SQLite migrations for part tracking
    this.storage.migrations = [
      {
        idMonotonicInc: 1,
        description: 'Create parts table',
        sql: `CREATE TABLE IF NOT EXISTS parts (
          part_number INTEGER PRIMARY KEY,
          part_start INTEGER,
          part_end INTEGER,
          r2_uploaded_part TEXT,
          completed BOOLEAN DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`,
      },
    ];

    // Run migrations synchronously during init
    await this.ctx.blockConcurrencyWhile(async () => {
      await this.storage.runMigrations();
    });

    // Resume existing multipart upload if we have one
    if (this.multiPartUploadId !== undefined && this.key !== undefined) {
      console.log('Resuming multipart upload:', this.key, this.multiPartUploadId);
      this._multiPartUpload = this.env.R2_BUCKET.resumeMultipartUpload(
        this.key,
        this.multiPartUploadId
      );
    }
  }

  async setup(originalFileName: string, fileSize: number): Promise<{ uploadId: string; key: string }> {
    this.originalFileName = originalFileName;
    this.fileSize = fileSize;

    // Generate unique key with timestamp
    const timestamp = Date.now();
    this.key = `videos/${timestamp}-${originalFileName}`;

    // Create the multipart upload
    this._multiPartUpload = await this.env.R2_BUCKET.createMultipartUpload(this.key);

    // Persist the upload ID
    this.multiPartUploadId = this._multiPartUpload.uploadId;

    // Clean up any previous parts
    this.sql`DELETE FROM parts;`;

    // Calculate and store part information
    const partCount = Math.ceil(fileSize / PART_SIZE);
    for (let i = 0; i < partCount; i++) {
      const partStart = i * PART_SIZE;
      let partEnd = partStart + PART_SIZE;

      // Last part may be smaller
      if (i === partCount - 1) {
        const remainder = fileSize % PART_SIZE;
        if (remainder > 0) {
          partEnd = partStart + remainder;
        }
      }

      // Store the part metadata
      this.sql`INSERT INTO parts (part_number, part_start, part_end, completed)
               VALUES (${i + 1}, ${partStart}, ${partEnd}, 0);`;
    }

    console.log(`Setup complete: ${partCount} parts for file ${this.key}`);

    return {
      uploadId: this.multiPartUploadId,
      key: this.key,
    };
  }

  async getMissingPartRequests(): Promise<PartRequest[]> {
    const missing = this.sql<Part>`SELECT * FROM parts WHERE completed = 0 ORDER BY part_number;`;

    const partRequests = missing.map((row) => ({
      partNumber: row.part_number as number,
      partStart: row.part_start as number,
      partEnd: row.part_end as number,
    }));

    return partRequests;
  }

  async getStatus(): Promise<{
    fileName: string;
    fileSize: number;
    key: string;
    uploadId: string;
    totalParts: number;
    completedParts: number;
    missingParts: PartRequest[];
  }> {
    const totalPartsResult = this.sql<{ count: number }>`SELECT COUNT(*) as count FROM parts;`;
    const completedPartsResult = this.sql<{ count: number }>`SELECT COUNT(*) as count FROM parts WHERE completed = 1;`;
    const missingParts = await this.getMissingPartRequests();

    return {
      fileName: this.originalFileName || '',
      fileSize: this.fileSize || 0,
      key: this.key || '',
      uploadId: this.multiPartUploadId || '',
      totalParts: totalPartsResult[0]?.count || 0,
      completedParts: completedPartsResult[0]?.count || 0,
      missingParts,
    };
  }

  // Helper to add CORS headers
  private addCorsHeaders(response: Response): Response {
    const newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    newHeaders.set('Access-Control-Allow-Headers', 'Content-Type');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Debug logging
    console.log('Actor fetch - pathname:', pathname);
    console.log('Actor fetch - method:', request.method);

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return this.addCorsHeaders(new Response(null, { status: 204 }));
    }

    // POST /setup - Initialize multipart upload
    if (request.method === 'POST' && pathname.includes('/setup')) {
      const body = await request.json<{ fileName: string; fileSize: number }>();
      const result = await this.setup(body.fileName, body.fileSize);
      return this.addCorsHeaders(Response.json(result));
    }

    // GET /status - Get upload status
    if (request.method === 'GET' && pathname.includes('/status')) {
      const status = await this.getStatus();
      return this.addCorsHeaders(Response.json(status));
    }

    // GET /missing - Get missing parts
    if (request.method === 'GET' && pathname.includes('/missing')) {
      const missing = await this.getMissingPartRequests();
      return this.addCorsHeaders(Response.json({ missingParts: missing }));
    }

    // PATCH /part/:partNumber - Upload a single part
    if (request.method === 'PATCH' && pathname.includes('/part/')) {
      const partNumber = parseInt(pathname.split('/part/')[1]);

      if (isNaN(partNumber)) {
        return this.addCorsHeaders(Response.json({ error: 'Invalid part number' }, { status: 400 }));
      }

      const mpu = this._multiPartUpload;
      if (!mpu) {
        return this.addCorsHeaders(Response.json({ error: 'Multipart upload not initialized' }, { status: 400 }));
      }

      if (!request.body) {
        return this.addCorsHeaders(Response.json({ error: 'Request body required' }, { status: 400 }));
      }

      try {
        // Upload the part to R2
        const uploadedPart = await mpu.uploadPart(partNumber, request.body);

        // Update the database
        this.sql`UPDATE parts SET
          r2_uploaded_part = ${JSON.stringify(uploadedPart)},
          completed = 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE part_number = ${partNumber}`;

        // Check if all parts are complete
        const remainingResult = this.sql<{ remaining: number }>`
          SELECT COUNT(*) as remaining FROM parts WHERE completed = 0
        `;
        const remainingCount = remainingResult[0]?.remaining || 0;

        // If all parts uploaded, complete the multipart upload
        if (remainingCount === 0) {
          console.log('All parts uploaded, completing multipart upload...');

          const partsResults = this.sql<{ r2_uploaded_part: string }>`
            SELECT r2_uploaded_part FROM parts ORDER BY part_number
          `;
          const parts = partsResults.map((row) => JSON.parse(row.r2_uploaded_part));

          const object = await mpu.complete(parts);

          return this.addCorsHeaders(Response.json({
            success: true,
            remainingCount: 0,
            completed: true,
            key: this.key,
            etag: object.httpEtag,
          }));
        }

        return this.addCorsHeaders(Response.json({
          success: true,
          remainingCount,
          completed: false,
          partNumber,
        }));
      } catch (error: any) {
        console.error('Error uploading part:', error);
        return this.addCorsHeaders(Response.json({ error: error.message }, { status: 500 }));
      }
    }

    // DELETE /abort - Abort the multipart upload
    if (request.method === 'DELETE' && pathname.includes('/abort')) {
      const mpu = this._multiPartUpload;
      if (mpu) {
        try {
          await mpu.abort();
          this.sql`DELETE FROM parts;`;
          this.multiPartUploadId = undefined;
          this.key = undefined;
          this._multiPartUpload = undefined;
          return this.addCorsHeaders(Response.json({ success: true, message: 'Upload aborted' }));
        } catch (error: any) {
          return this.addCorsHeaders(Response.json({ error: error.message }, { status: 500 }));
        }
      }
      return this.addCorsHeaders(Response.json({ error: 'No upload to abort' }, { status: 400 }));
    }

    return this.addCorsHeaders(new Response('Not Found', { status: 404 }));
  }
}

// Export the actor handler directly as default
export default handler(Uploader);
