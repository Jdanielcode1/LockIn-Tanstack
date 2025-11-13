import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  R2_BUCKET: R2Bucket;
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS for all routes
app.use('/*', cors());

/**
 * POST /:key?action=mpu-create
 * Create a new multipart upload
 */
app.post('/:key', async (c) => {
  const action = c.req.query('action');

  if (action === 'mpu-create') {
    const key = c.req.param('key');
    const bucket = c.env.R2_BUCKET;

    try {
      const multipartUpload = await bucket.createMultipartUpload(key);

      console.log(`Created multipart upload: ${key} with uploadId: ${multipartUpload.uploadId}`);

      return c.json({
        key: multipartUpload.key,
        uploadId: multipartUpload.uploadId,
      });
    } catch (error: any) {
      console.error('Error creating multipart upload:', error);
      return c.json({ error: error.message }, 500);
    }
  }

  if (action === 'mpu-complete') {
    const key = c.req.param('key');
    const uploadId = c.req.query('uploadId');
    const bucket = c.env.R2_BUCKET;

    if (!uploadId) {
      return c.json({ error: 'Missing uploadId' }, 400);
    }

    try {
      const body = await c.req.json<{ parts: R2UploadedPart[] }>();

      if (!body || !body.parts) {
        return c.json({ error: 'Missing or incomplete body' }, 400);
      }

      const multipartUpload = bucket.resumeMultipartUpload(key, uploadId);
      const object = await multipartUpload.complete(body.parts);

      console.log(`Completed multipart upload: ${key}`);

      return c.json({
        success: true,
        key: object.key,
        etag: object.httpEtag,
      });
    } catch (error: any) {
      console.error('Error completing multipart upload:', error);
      return c.json({ error: error.message }, 400);
    }
  }

  return c.json({ error: `Unknown action: ${action}` }, 400);
});

/**
 * PUT /:key?action=mpu-uploadpart&uploadId=X&partNumber=Y
 * Upload a single part
 */
app.put('/:key', async (c) => {
  const action = c.req.query('action');

  if (action !== 'mpu-uploadpart') {
    return c.json({ error: `Unknown action: ${action}` }, 400);
  }

  const key = c.req.param('key');
  const uploadId = c.req.query('uploadId');
  const partNumberString = c.req.query('partNumber');
  const bucket = c.env.R2_BUCKET;

  if (!uploadId || !partNumberString) {
    return c.json({ error: 'Missing uploadId or partNumber' }, 400);
  }

  const partNumber = parseInt(partNumberString);

  if (isNaN(partNumber)) {
    return c.json({ error: 'Invalid partNumber' }, 400);
  }

  try {
    const multipartUpload = bucket.resumeMultipartUpload(key, uploadId);
    const uploadedPart = await multipartUpload.uploadPart(partNumber, c.req.raw.body);

    return c.json(uploadedPart);
  } catch (error: any) {
    console.error(`Error uploading part ${partNumber}:`, error);
    return c.json({ error: error.message }, 400);
  }
});

/**
 * GET /:key?action=get
 * Get an object from R2
 */
app.get('/:key', async (c) => {
  const action = c.req.query('action');

  if (action !== 'get') {
    return c.json({ error: `Unknown action: ${action}` }, 400);
  }

  const key = c.req.param('key');
  const bucket = c.env.R2_BUCKET;

  try {
    const object = await bucket.get(key);

    if (!object) {
      return c.json({ error: 'Object not found' }, 404);
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);

    return c.body(object.body, { headers });
  } catch (error: any) {
    console.error('Error getting object:', error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * DELETE /:key?action=mpu-abort&uploadId=X
 * Abort a multipart upload
 */
app.delete('/:key', async (c) => {
  const action = c.req.query('action');
  const key = c.req.param('key');
  const bucket = c.env.R2_BUCKET;

  if (action === 'mpu-abort') {
    const uploadId = c.req.query('uploadId');

    if (!uploadId) {
      return c.json({ error: 'Missing uploadId' }, 400);
    }

    try {
      const multipartUpload = bucket.resumeMultipartUpload(key, uploadId);
      await multipartUpload.abort();

      console.log(`Aborted multipart upload: ${key}`);

      return c.body(null, 204);
    } catch (error: any) {
      console.error('Error aborting multipart upload:', error);
      return c.json({ error: error.message }, 400);
    }
  }

  if (action === 'delete') {
    try {
      await bucket.delete(key);

      console.log(`Deleted object: ${key}`);

      return c.body(null, 204);
    } catch (error: any) {
      console.error('Error deleting object:', error);
      return c.json({ error: error.message }, 500);
    }
  }

  return c.json({ error: `Unknown action: ${action}` }, 400);
});

export default app;
