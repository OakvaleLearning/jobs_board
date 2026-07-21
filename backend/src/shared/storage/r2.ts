import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { loadEnv } from '../config/env.js';
import { logger } from '../logger/logger.js';
import { AppError } from '../errors/app-error.js';

const env = loadEnv();

const configured = Boolean(
  env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY && env.S3_ENDPOINT,
);

if (!configured && env.NODE_ENV !== 'production') {
  logger.warn(
    { s3: 'unconfigured' },
    'R2/S3 credentials not set; upload-URL endpoints will reject. Set S3_* env vars to enable.',
  );
}

const client = configured
  ? new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    })
  : null;

function requireClient(): S3Client {
  if (!client) {
    throw new AppError({
      code: 'STORAGE_UNAVAILABLE',
      message: 'Object storage is not configured on this server.',
      statusCode: 503,
    });
  }
  return client;
}

export const storage = {
  isConfigured: () => configured,

  async getPutUrl(key: string, contentType: string, sizeBytes: number): Promise<string> {
    const c = requireClient();
    const cmd = new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      ContentType: contentType,
      ContentLength: sizeBytes,
    });
    return getSignedUrl(c, cmd, { expiresIn: 900 });
  },

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    const c = requireClient();
    await c.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        ContentLength: body.length,
      }),
    );
  },

  async getObjectBuffer(key: string): Promise<Buffer> {
    const c = requireClient();
    const res = await c.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    const body = res.Body;
    if (!body) {
      throw new AppError({
        code: 'STORAGE_OBJECT_EMPTY',
        message: `Object ${key} has no body.`,
        statusCode: 502,
      });
    }
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  },

  async getGetUrl(key: string): Promise<string> {
    // When a public R2 base URL is configured, return a permanent, unsigned URL
    // that never expires. Falls back to a short-lived presigned GET otherwise so
    // local/dev without a public domain keeps working.
    if (env.S3_PUBLIC_URL) {
      return `${env.S3_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
    }
    const c = requireClient();
    return getSignedUrl(c, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), {
      expiresIn: 300,
    });
  },

  async deleteObject(key: string): Promise<void> {
    const c = requireClient();
    await c.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  },

  async headObject(key: string): Promise<{ size: number; contentType: string } | null> {
    try {
      const c = requireClient();
      const res = await c.send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
      return { size: Number(res.ContentLength ?? 0), contentType: res.ContentType ?? '' };
    } catch {
      return null;
    }
  },
};
