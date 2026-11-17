"use server";

import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/db/client";
import { businessSettings, businesses } from "@/db/schema";
import { requirePermission } from "@/lib/auth";

export interface SettingsInput {
  name: string;
  timezone: string;
  phone: string;
  email: string;
  address: string;
  currency: string;
  trn: string;
  taxLabel: string;
  taxRate: number;
  dailySummaryEnabled: boolean;
  dailySummaryTime: string;
  emailSummaryEnabled: boolean;
  reminderDays: number[];
  overdueAlertsEnabled: boolean;
  delayWarningsEnabled: boolean;
  holdAlertDays: number;
}

/* ------------------------------------------------------------------ */
/* Email provider configuration (Settings → Email Setup)               */
/* ------------------------------------------------------------------ */

export interface EmailConfigInput {
  provider: "none" | "resend" | "smtp";
  from: string;
  apiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPassword?: string;
}

export interface EmailConfigStatus {
  provider: string;
  from: string;
  hasApiKey: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  hasSmtpPassword: boolean;
  source: "env" | "settings" | "none";
  envOverride: boolean;
}

/** Non-secret view of the effective email config for the Settings page. */
export async function getEmailConfigStatus(): Promise<EmailConfigStatus> {
  const session = await requirePermission("manageSettings");
  const { getEmailConfig } = await import("./notifications/email");
  const config = await getEmailConfig(session.businessId);
  return {
    provider: config.provider,
    from: config.from,
    hasApiKey: Boolean(config.apiKey),
    smtpHost: config.smtpHost ?? null,
    smtpPort: config.smtpPort ?? null,
    smtpSecure: Boolean(config.smtpSecure),
    smtpUser: config.smtpUser ?? null,
    hasSmtpPassword: Boolean(config.smtpPassword),
    source: config.source,
    envOverride: config.source === "env",
  };
}

export async function saveEmailConfig(input: unknown): Promise<{ ok?: boolean; error?: string }> {
  const session = await requirePermission("manageSettings");
  const data = input as EmailConfigInput;
  if (!data?.provider) return { error: "Provider is required" };

  const db = getDb();
  const [existing] = await db
    .select()
    .from(businessSettings)
    .where(eq(businessSettings.businessId, session.businessId))
    .limit(1);

  // Blank password/api key fields mean "keep the saved value".
  const keepPassword = !data.smtpPassword && existing?.smtpPassword;
  const keepApiKey = !data.apiKey && existing?.emailApiKey;

  await db
    .update(businessSettings)
    .set({
      emailProvider: data.provider,
      emailFrom: data.from || null,
      emailApiKey: data.provider === "resend" ? (keepApiKey ? existing!.emailApiKey : data.apiKey || null) : null,
      smtpHost: data.provider === "smtp" ? data.smtpHost || null : null,
      smtpPort: data.provider === "smtp" ? data.smtpPort ?? 587 : 587,
      smtpSecure: data.provider === "smtp" ? Boolean(data.smtpSecure) : false,
      smtpUser: data.provider === "smtp" ? data.smtpUser || null : null,
      smtpPassword: data.provider === "smtp"
        ? (keepPassword ? existing!.smtpPassword : data.smtpPassword || null)
        : null,
      updatedAt: new Date(),
    })
    .where(eq(businessSettings.businessId, session.businessId));

  revalidatePath("/settings");
  return { ok: true };
}

export async function sendTestEmail(): Promise<{ ok: boolean; error?: string; source?: string }> {
  const session = await requirePermission("manageSettings");
  const { sendTestEmail: send } = await import("./notifications/email");
  return send(session.businessId, session.email);
}

export async function updateSettings(input: unknown) {
  const session = await requirePermission("manageSettings");
  const data = input as SettingsInput;
  if (!data?.name) return { error: "Business name is required" };

  const db = getDb();
  await db
    .update(businesses)
    .set({
      name: data.name,
      timezone: data.timezone || "Asia/Kolkata",
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      currency: data.currency || "INR",
      trn: data.trn || null,
      updatedAt: new Date(),
    })
    .where(eq(businesses.id, session.businessId));

  await db
    .update(businessSettings)
    .set({
      taxLabel: data.taxLabel,
      taxRate: String(data.taxRate),
      dailySummaryEnabled: data.dailySummaryEnabled,
      dailySummaryTime: data.dailySummaryTime,
      emailSummaryEnabled: data.emailSummaryEnabled,
      reminderDays: data.reminderDays,
      overdueAlertsEnabled: data.overdueAlertsEnabled,
      delayWarningsEnabled: data.delayWarningsEnabled,
      holdAlertDays: data.holdAlertDays,
      updatedAt: new Date(),
    })
    .where(eq(businessSettings.businessId, session.businessId));

  revalidatePath("/settings");
  revalidatePath("/billing");
  revalidatePath("/dashboard");
  return { ok: true };
}

void and;
