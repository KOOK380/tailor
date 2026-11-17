"use server";

import { revalidatePath } from "next/cache";
import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { notificationPreferences, type NotificationType } from "@/db/schema";
import { requireSession } from "@/lib/auth";

/**
 * User-level notification preferences (Module 4.H user settings): per
 * category (deadline / production / summary / payments) and per channel
 * (in-app / push / email). Absent rows mean: in-app on, push on, email off.
 */

/**
 * Category → notification-type mapping. Not exported: "use server" modules
 * may only export async functions (types are fine).
 */
const PREFERENCE_CATEGORIES: {
  key: string;
  label: string;
  types: NotificationType[];
}[] = [
  {
    key: "deadline",
    label: "Deadline alerts",
    types: [
      "early_reminder",
      "upcoming_deadline",
      "warning",
      "urgent",
      "critical",
      "due_today",
      "overdue",
    ],
  },
  {
    key: "production",
    label: "Production updates",
    types: [
      "task_assigned",
      "stage_ready",
      "task_reminder",
      "stage_overdue",
      "stage_completed",
      "production_delay",
      "hold_alert",
      "employee_overload",
      "ready_for_delivery",
      "order_reassigned",
    ],
  },
  {
    key: "summary",
    label: "Daily summary",
    types: ["daily_summary"],
  },
  {
    key: "payments",
    label: "Payment reminders",
    types: ["payment_due"],
  },
];

export interface CategoryPreference {
  key: string;
  label: string;
  inAppEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
}

export async function getMyNotificationPreferences(): Promise<CategoryPreference[]> {
  const session = await requireSession();
  const db = getDb();
  const rows = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, session.userId));

  return PREFERENCE_CATEGORIES.map((cat) => {
    const prefs = rows.filter((r) =>
      cat.types.includes(r.notificationType as NotificationType),
    );
    const any = prefs.length > 0;
    return {
      key: cat.key,
      label: cat.label,
      inAppEnabled: any ? prefs.every((p) => p.inAppEnabled) : true,
      pushEnabled: any ? prefs.every((p) => p.pushEnabled) : true,
      emailEnabled: any ? prefs.some((p) => p.emailEnabled) : false,
    };
  });
}

export type PreferenceChannel = "inAppEnabled" | "pushEnabled" | "emailEnabled";

/** Toggle a channel for every notification type in a category. */
export async function setCategoryPreference(
  categoryKey: string,
  channel: PreferenceChannel,
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession();
  const category = PREFERENCE_CATEGORIES.find((c) => c.key === categoryKey);
  if (!category) return { ok: false, error: "Unknown category" };

  const db = getDb();
  for (const type of category.types) {
    const [existing] = await db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.userId, session.userId),
          eq(notificationPreferences.businessId, session.businessId),
          eq(notificationPreferences.notificationType, type),
        ),
      )
      .limit(1);

    const patch = {
      inAppEnabled: existing?.inAppEnabled ?? true,
      pushEnabled: existing?.pushEnabled ?? true,
      emailEnabled: existing?.emailEnabled ?? false,
      [channel]: enabled,
    };

    if (existing) {
      await db
        .update(notificationPreferences)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(notificationPreferences.id, existing.id));
    } else {
      await db.insert(notificationPreferences).values({
        userId: session.userId,
        businessId: session.businessId,
        notificationType: type,
        ...patch,
      });
    }
  }

  revalidatePath("/notifications");
  revalidatePath("/settings");
  return { ok: true };
}

void inArray;
