/**
 * Migration runner that works in both driver modes.
 *
 * Applies every unapplied SQL file in src/db/migrations (sorted by name),
 * each inside a transaction, and records it in _migrations. Run with:
 *   npm run db:migrate
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { rawQuery, dbReady } from "./client";

const MIGRATIONS_DIR = path.join(process.cwd(), "src", "db", "migrations");

export async function runMigrations(): Promise<string[]> {
  await dbReady();
  await rawQuery(
    `CREATE TABLE IF NOT EXISTS _migrations (
       name text PRIMARY KEY,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );

  const appliedRes = await rawQuery(`SELECT name FROM _migrations`);
  const applied = new Set((appliedRes.rows as { name: string }[]).map((r) => r.name));

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sqlText = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    // PGlite and pg both accept multi-statement strings.
    await rawQuery(sqlText);
    await rawQuery(`INSERT INTO _migrations (name) VALUES ($1)`, [file]);
    ran.push(file);
    console.log(`[migrate] applied ${file}`);
  }
  return ran;
}

// CLI entry
const isMain = process.argv[1] && path.basename(process.argv[1]).startsWith("migrate");
if (isMain) {
  runMigrations()
    .then((ran) => {
      console.log(
        ran.length ? `[migrate] done: ${ran.length} migration(s)` : "[migrate] up to date",
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error("[migrate] failed:", err);
      process.exit(1);
    });
}
