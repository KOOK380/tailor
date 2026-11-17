/**
 * File storage (Module 10).
 *
 * Resolution order for bytes:
 *   1. S3-compatible object storage (Neon Storage) when AWS_* env vars are
 *      configured — the scalable, deploy-safe home for files.
 *   2. In-database bytea (storage_files.data) — zero-config local/dev.
 *   3. Legacy on-disk `uploads/` folder — read-only fallback for old logos.
 *
 * Metadata (name, mime, size) always lives in storage_files so listing and
 * tenant checks stay in Postgres regardless of where the bytes are.
 */
import { randomUUID } from "node:crypto";
import { eq, and, desc } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getDb } from "@/db/client";
import { storageFiles, businesses, orderAttachments } from "@/db/schema";
import { isS3Configured, s3GetFile, s3PutFile } from "@/server/s3";

export interface StoredFile {
  id: string;
  fileName: string;
  mimeType: string;
  data: Buffer;
}

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

/** Save (or replace) the business logo. */
export async function saveBusinessLogo(
  businessId: string,
  file: { name: string; type: string; data: Buffer },
): Promise<{ ok: boolean; error?: string }> {
  if (!ALLOWED_TYPES.has(file.type)) {
    return { ok: false, error: "Please upload a PNG, JPG, WEBP or SVG image" };
  }
  if (file.data.length > 2 * 1024 * 1024) {
    return { ok: false, error: "Logo must be under 2 MB" };
  }
  const db = getDb();
  const useS3 = isS3Configured();
  const storageKey = `logos/${businessId}`;
  if (useS3) {
    await s3PutFile(storageKey, file.data, file.type);
  }
  await db.delete(storageFiles).where(eq(storageFiles.purpose, "logo"));
  await db.insert(storageFiles).values({
    businessId,
    purpose: "logo",
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.data.length,
    storageKey: useS3 ? storageKey : null,
    data: useS3 ? Buffer.alloc(0) : file.data,
  });
  await db
    .update(businesses)
    .set({ logoPath: file.name, updatedAt: new Date() })
    .where(eq(businesses.id, businessId));
  return { ok: true };
}

/** Fetch the business logo — S3 → database → legacy disk file. */
export async function getBusinessLogo(businessId: string): Promise<StoredFile | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(storageFiles)
    .where(
      and(eq(storageFiles.businessId, businessId), eq(storageFiles.purpose, "logo")),
    )
    .limit(1);
  if (row) {
    if (row.storageKey) {
      const s3 = await s3GetFile(row.storageKey);
      if (s3) {
        return {
          id: row.id,
          fileName: row.fileName,
          mimeType: s3.contentType,
          data: s3.data,
        };
      }
    }
    return {
      id: row.id,
      fileName: row.fileName,
      mimeType: row.mimeType ?? "image/png",
      data: row.data as unknown as Buffer,
    };
  }
  // Fallback: logo uploaded before DB storage existed.
  const [biz] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);
  if (biz?.logoPath) {
    try {
      const bytes = await readFile(
        path.join(process.cwd(), "uploads", path.basename(biz.logoPath)),
      );
      return {
        id: "disk",
        fileName: biz.logoPath,
        mimeType: biz.logoPath.endsWith(".svg") ? "image/svg+xml" : "image/png",
        data: bytes,
      };
    } catch {
      return null;
    }
  }
  return null;
}

/** Save an order reference image (gallery + order_attachments row). */
export async function saveOrderImage(
  businessId: string,
  orderId: string,
  file: { name: string; type: string; data: Buffer },
  uploadedBy: string,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!ALLOWED_TYPES.has(file.type)) {
    return { ok: false, error: "Only PNG, JPG, WEBP or SVG images are allowed" };
  }
  if (file.data.length > 5 * 1024 * 1024) {
    return { ok: false, error: "Image must be under 5 MB" };
  }
  const db = getDb();
  const id = randomUUID();
  const useS3 = isS3Configured();
  const storageKey = `orders/${orderId}/${id}`;
  if (useS3) {
    await s3PutFile(storageKey, file.data, file.type);
  }
  await db.insert(storageFiles).values({
    id,
    businessId,
    purpose: "order_attachment",
    refId: orderId,
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.data.length,
    storageKey: useS3 ? storageKey : null,
    data: useS3 ? Buffer.alloc(0) : file.data,
  });
  await db.insert(orderAttachments).values({
    businessId,
    orderId,
    kind: "reference_image",
    fileName: file.name,
    storagePath: useS3 ? `s3:${storageKey}` : `db:storage_files/${id}`,
    mimeType: file.type,
    sizeBytes: file.data.length,
    uploadedBy,
  });
  return { ok: true, id };
}

/** List order images (metadata only — no bytes). */
export async function listOrderImages(orderId: string) {
  const db = getDb();
  return db
    .select({
      id: storageFiles.id,
      fileName: storageFiles.fileName,
      mimeType: storageFiles.mimeType,
      sizeBytes: storageFiles.sizeBytes,
      createdAt: storageFiles.createdAt,
    })
    .from(storageFiles)
    .where(
      and(
        eq(storageFiles.purpose, "order_attachment"),
        eq(storageFiles.refId, orderId),
      ),
    )
    .orderBy(desc(storageFiles.createdAt))
    .limit(24);
}

/** Fetch one stored file by id (tenant-checked by the caller). */
export async function getStoredFile(id: string): Promise<StoredFile | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(storageFiles)
    .where(eq(storageFiles.id, id))
    .limit(1);
  if (!row) return null;
  if (row.storageKey) {
    const s3 = await s3GetFile(row.storageKey);
    if (s3) {
      return {
        id: row.id,
        fileName: row.fileName,
        mimeType: s3.contentType,
        data: s3.data,
      };
    }
  }
  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType ?? "application/octet-stream",
    data: row.data as unknown as Buffer,
  };
}
