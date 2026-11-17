/**
 * Tenant context helpers.
 *
 * Every business-scoped query should run inside withTenant(), which pins the
 * RLS session GUCs (app.business_id / app.user_id) for the transaction and
 * guarantees the connection is on the right tenant in Supabase mode.
 */
import { sql } from "drizzle-orm";
import { getDb, type Db } from "./client";

export interface TenantContext {
  businessId: string;
  userId?: string;
}

export async function setTenantContext(ctx: TenantContext): Promise<void> {
  const db = getDb();
  await db.execute(sql`select set_config('app.business_id', ${ctx.businessId}, true)`);
  await db.execute(
    sql`select set_config('app.user_id', ${ctx.userId ?? ""}, true)`,
  );
}

/**
 * Run `fn` inside a transaction with tenant GUCs set (RLS-safe).
 * Use this for multi-statement business operations.
 */
export async function withTenant<T>(
  ctx: TenantContext,
  fn: (db: Db) => Promise<T>,
): Promise<T> {
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.business_id', ${ctx.businessId}, true)`);
    await tx.execute(sql`select set_config('app.user_id', ${ctx.userId ?? ""}, true)`);
    return fn(tx as unknown as Db);
  });
}
