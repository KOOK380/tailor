"use server";

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { businesses, businessSettings } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { DEFAULT_CURRENCY } from "@/lib/currency";

/** Currency code configured for the current business (default INR). */
export async function getBusinessCurrency(): Promise<string> {
  const session = await requireSession();
  const db = getDb();
  const [biz] = await db
    .select({ currency: businesses.currency })
    .from(businesses)
    .where(eq(businesses.id, session.businessId))
    .limit(1);
  return biz?.currency ?? DEFAULT_CURRENCY;
}

/** Whether the admin enabled company-rule email summaries/alerts. */
export async function getEmailSummaryEnabled(): Promise<boolean> {
  const session = await requireSession();
  const db = getDb();
  const [settings] = await db
    .select({ enabled: businessSettings.emailSummaryEnabled })
    .from(businessSettings)
    .where(eq(businessSettings.businessId, session.businessId))
    .limit(1);
  return settings?.enabled ?? false;
}

export interface BusinessProfile {
  name: string;
  trn: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  hasLogo: boolean;
}

/** Supplier identity used on invoices (UAE/GCC tax invoice header). */
export async function getBusinessProfile(): Promise<BusinessProfile> {
  const session = await requireSession();
  const db = getDb();
  const [biz] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, session.businessId))
    .limit(1);
  return {
    name: biz?.name ?? "",
    trn: biz?.trn ?? null,
    address: biz?.address ?? null,
    phone: biz?.phone ?? null,
    email: biz?.email ?? null,
    currency: biz?.currency ?? "INR",
    hasLogo: Boolean(biz?.logoPath),
  };
}
