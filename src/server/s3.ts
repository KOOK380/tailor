/**
 * S3-compatible object storage (Neon Storage — or any S3 service).
 *
 * Activates when AWS_ENDPOINT_URL_S3 + credentials are configured (see
 * .env.example). Files then live in object storage instead of the database;
 * the DB keeps only metadata (storage_files.storage_key). Falls back to the
 * in-database bytea storage when S3 is not configured.
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";

export function isS3Configured(): boolean {
  return Boolean(
    process.env.AWS_ENDPOINT_URL_S3 &&
      process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY,
  );
}

export const S3_BUCKET = process.env.AWS_S3_BUCKET || "tailor-files";

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: process.env.AWS_ENDPOINT_URL_S3,
      region: process.env.AWS_REGION || "ap-southeast-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true, // most S3-compatible services expect path-style
    });
  }
  return client;
}

/** Make sure the bucket exists (created once on first use if allowed). */
async function ensureBucket(): Promise<void> {
  const s3 = getClient();
  try {
    await s3.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
  } catch {
    try {
      await s3.send(new CreateBucketCommand({ Bucket: S3_BUCKET }));
    } catch {
      // Service may manage buckets centrally — uploads will surface errors.
    }
  }
}

/** Store a file in S3-compatible storage. */
export async function s3PutFile(
  key: string,
  data: Buffer,
  contentType: string,
): Promise<void> {
  await ensureBucket();
  await getClient().send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: data,
      ContentType: contentType,
    }),
  );
}

/** Fetch a file from S3-compatible storage. */
export async function s3GetFile(
  key: string,
): Promise<{ data: Buffer; contentType: string } | null> {
  try {
    const res = await getClient().send(
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
    );
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) return null;
    return {
      data: Buffer.from(bytes),
      contentType: res.ContentType ?? "application/octet-stream",
    };
  } catch {
    return null;
  }
}
