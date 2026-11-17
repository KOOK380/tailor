/**
 * Dual-mode database client.
 *
 * - Default (no DATABASE_URL): PGlite — real Postgres compiled to WASM, stored
 *   on the local filesystem. Zero external services; the app is fully runnable.
 * - DATABASE_URL set: node-postgres pool → any Postgres, including Supabase.
 *
 * Both modes share the exact same SQL migrations and Drizzle schema.
 */
import { PGlite } from "@electric-sql/pglite";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = PgliteDatabase<typeof schema> | NodePgDatabase<typeof schema>;

const GLOBAL_KEY = Symbol.for("tailor.db");

interface GlobalDb {
  db: Db;
  pglite?: PGlite;
  pool?: Pool;
  ready: Promise<void>;
}

function createDb(): GlobalDb {
  const rawUrl = process.env.DATABASE_URL;

  if (rawUrl) {
    // node-postgres doesn't implement channel binding — strip that param so
    // Neon's default connection string works as-is.
    const databaseUrl = rawUrl
      .replace(/([?&])channel_binding=[^&]*/i, "$1")
      .replace(/[?&]$/, "");
    // Hosted Postgres (Neon, Supabase, …) usually requires TLS; their pooled
    // endpoints use certs node-postgres can't verify against system CAs, so
    // request SSL without strict CA verification when the URL asks for it.
    const wantsSsl =
      /sslmode=require/i.test(databaseUrl) ||
      /neon\.tech|supabase\.co|amazonaws\.com/i.test(databaseUrl);
    const pool = new Pool({
      connectionString: databaseUrl,
      max: 10,
      ...(wantsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    });
    const db = drizzlePg(pool, { schema });
    return { db, pool, ready: Promise.resolve() };
  }

  // Local PGlite, persisted OUTSIDE the project folder by default:
  // a data directory inside the repo makes the dev server's file watcher
  // recompile (and the page reload) on every database write. On OneDrive-
  // synced folders that turns into a constant refresh loop.
  const dataDir =
    process.env.PGLITE_DATA_DIR ??
    path.join(homedir(), "AppData", "Local", "tailor-management", "pglite");
  // PGlite does not create missing parent directories on Windows.
  mkdirSync(dataDir, { recursive: true });
  const pglite = new PGlite(dataDir);
  const db = drizzlePglite(pglite, { schema });
  const ready = pglite.waitReady.then(() => undefined);
  return { db, pglite, ready };
}

function getGlobal(): GlobalDb {
  const g = globalThis as unknown as Record<symbol, GlobalDb | undefined>;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = createDb();
  }
  return g[GLOBAL_KEY]!;
}

/** The shared Drizzle database instance. */
export function getDb(): Db {
  return getGlobal().db;
}

/** Await one-time driver initialisation (PGlite boot). */
export async function dbReady(): Promise<void> {
  await getGlobal().ready;
}

/** Escape hatch for raw SQL through the underlying driver. */
export async function rawQuery(sqlText: string, params: unknown[] = []): Promise<{ rows: unknown[] }> {
  const g = getGlobal();
  await g.ready;
  if (g.pglite) {
    if (params.length === 0) {
      // exec() supports multi-statement SQL (needed for migrations).
      const res = await g.pglite.exec(sqlText);
      const last = res[res.length - 1];
      return { rows: (last?.rows ?? []) as unknown[] };
    }
    const res = await g.pglite.query(sqlText, params as never[]);
    return { rows: res.rows as unknown[] };
  }
  const res = await g.pool!.query(sqlText, params as never[]);
  return { rows: res.rows as unknown[] };
}

export { schema };
