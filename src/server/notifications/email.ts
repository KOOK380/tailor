/**
 * Email delivery channel (Modules 4.G/H).
 *
 * Optional — activates when a provider is configured either in
 * **Settings → Email Setup** (stored per business) or via the EMAIL_*
 * environment variables (which override the saved settings). Supported
 * providers:
 *   - resend → Resend HTTP API (api key + from address)
 *   - smtp   → any SMTP server (host/port/user/password/from)
 *
 * When unconfigured, sends are skipped gracefully; in-app notifications keep
 * working regardless (spec Module 4.D/E).
 */
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  notifications,
  notificationDeliveryAttempts,
  notificationPreferences,
  businessSettings,
  userProfiles,
} from "@/db/schema";

export interface EmailConfig {
  provider: "none" | "resend" | "smtp";
  from: string;
  apiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPassword?: string;
  /** Where the effective config came from. */
  source: "env" | "settings" | "none";
}

/**
 * Resolve the effective email config: environment variables win, then the
 * per-business Settings values.
 */
export async function getEmailConfig(businessId: string): Promise<EmailConfig> {
  const envProvider = process.env.EMAIL_PROVIDER;
  if (envProvider === "resend" && process.env.EMAIL_API_KEY && process.env.EMAIL_FROM) {
    return {
      provider: "resend",
      from: process.env.EMAIL_FROM,
      apiKey: process.env.EMAIL_API_KEY,
      source: "env",
    };
  }
  if (
    envProvider === "smtp" &&
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASSWORD &&
    process.env.EMAIL_FROM
  ) {
    return {
      provider: "smtp",
      from: process.env.EMAIL_FROM,
      smtpHost: process.env.SMTP_HOST,
      smtpPort: Number(process.env.SMTP_PORT ?? 587),
      smtpSecure: process.env.SMTP_SECURE === "true",
      smtpUser: process.env.SMTP_USER,
      smtpPassword: process.env.SMTP_PASSWORD,
      source: "env",
    };
  }

  const db = getDb();
  const [s] = await db
    .select()
    .from(businessSettings)
    .where(eq(businessSettings.businessId, businessId))
    .limit(1);
  if (s && s.emailProvider !== "none" && s.emailFrom) {
    const valid =
      s.emailProvider === "resend"
        ? Boolean(s.emailApiKey)
        : Boolean(s.smtpHost && s.smtpUser && s.smtpPassword);
    if (valid) {
      return {
        provider: s.emailProvider as "resend" | "smtp",
        from: s.emailFrom,
        apiKey: s.emailApiKey ?? undefined,
        smtpHost: s.smtpHost ?? undefined,
        smtpPort: s.smtpPort ?? 587,
        smtpSecure: s.smtpSecure ?? false,
        smtpUser: s.smtpUser ?? undefined,
        smtpPassword: s.smtpPassword ?? undefined,
        source: "settings",
      };
    }
  }
  return { provider: "none", from: "", source: "none" };
}

export function isEmailConfigured(config: EmailConfig): boolean {
  return config.provider !== "none" && Boolean(config.from);
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Send one email through the given config. Throws on provider errors. */
export async function sendEmail(
  message: EmailMessage,
  config: EmailConfig,
): Promise<void> {
  if (config.provider === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend error ${res.status}: ${body.slice(0, 200)}`);
    }
    return;
  }

  if (config.provider === "smtp") {
    const nodemailer = (await import("nodemailer")).default;
    const transport = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort ?? 587,
      secure: config.smtpSecure ?? false,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPassword,
      },
    });
    await transport.sendMail({
      from: config.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    });
    return;
  }

  throw new Error("Email provider not configured");
}

/** Send a test email to verify the saved configuration works. */
export async function sendTestEmail(
  businessId: string,
  to: string,
): Promise<{ ok: boolean; error?: string; source?: string }> {
  const config = await getEmailConfig(businessId);
  if (!isEmailConfigured(config)) {
    return { ok: false, error: "No email provider configured yet" };
  }
  try {
    await sendEmail(
      {
        to,
        subject: "Test email — Tailor Management",
        text: `This is a test email from your Tailor Management System.\n\nProvider: ${config.provider} (via ${config.source})\nIf you received this, email notifications are set up correctly.`,
      },
      config,
    );
    return { ok: true, source: config.source };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "send failed" };
  }
}

/**
 * Fan out email for freshly created notifications (called after bulk insert,
 * alongside push dispatch). Policy (Module 4.H):
 *  - Company rule: when the admin enabled "email summary/alerts", the daily
 *    summary and critical alerts are emailed to their recipients.
 *  - User opt-in: notification_preferences.emailEnabled per type.
 */
export async function dispatchEmailForNotifications(
  businessId: string,
  notificationIds: string[],
): Promise<void> {
  if (notificationIds.length === 0) return;
  const config = await getEmailConfig(businessId);
  if (!isEmailConfigured(config)) return;
  const db = getDb();

  const [settings] = await db
    .select()
    .from(businessSettings)
    .where(eq(businessSettings.businessId, businessId))
    .limit(1);

  const rows = await db
    .select()
    .from(notifications)
    .where(inArray(notifications.id, notificationIds));

  for (const n of rows) {
    if (!n.recipientUserId) continue;

    const [user] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.id, n.recipientUserId))
      .limit(1);
    if (!user?.email) continue;

    const userPrefs = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, n.recipientUserId));
    const typePref = userPrefs.find((p) => p.notificationType === n.type);

    const companyRule =
      Boolean(settings?.emailSummaryEnabled) &&
      (n.type === "daily_summary" || n.priority === "critical");
    const userOptIn = typePref?.emailEnabled === true;
    if (!companyRule && !userOptIn) continue;

    const [attempt] = await db
      .insert(notificationDeliveryAttempts)
      .values({
        businessId,
        notificationId: n.id,
        channel: "email",
        deliveryStatus: "pending",
        attemptCount: 1,
        lastAttemptAt: new Date(),
      })
      .returning();

    const mark = async (status: "sent" | "failed", error?: string) => {
      await db
        .update(notificationDeliveryAttempts)
        .set({
          deliveryStatus: status,
          errorDetails: error ?? null,
          updatedAt: new Date(),
        })
        .where(eq(notificationDeliveryAttempts.id, attempt.id));
    };

    try {
      await sendEmail(
        {
          to: user.email,
          subject: n.title,
          text: `${n.message}\n\n— Tailor Management System`,
        },
        config,
      );
      await mark("sent");
    } catch (err) {
      await mark("failed", err instanceof Error ? err.message : "send failed");
    }
  }
}
