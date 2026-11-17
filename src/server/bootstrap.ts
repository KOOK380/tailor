/**
 * Per-business initialization: production stage definitions, business settings,
 * and default notification rules (Modules 2 & 5).
 */
import { getDb } from "@/db/client";
import {
  productionStageDefinitions,
  businessSettings,
  notificationRules,
  STAGE_ORDER,
  STAGE_LABELS,
  OPTIONAL_STAGES,
} from "@/db/schema";

/** Estimated durations (hours) per stage for delay detection defaults. */
const STAGE_DEFAULT_HOURS: Record<string, number> = {
  order_created: 2,
  cutting: 8,
  designing: 12,
  embroidery: 24,
  stone_crystals: 16,
  hand_work: 16,
  stitching: 16,
  finished: 2,
};

export async function initializeBusiness(businessId: string): Promise<void> {
  const db = getDb();

  await db
    .insert(businessSettings)
    .values({ businessId })
    .onConflictDoNothing();

  await db
    .insert(productionStageDefinitions)
    .values(
      STAGE_ORDER.map((key, i) => ({
        businessId,
        key,
        name: STAGE_LABELS[key],
        sequence: i + 1,
        isMandatory: !OPTIONAL_STAGES.includes(key),
        defaultEstimatedHours: STAGE_DEFAULT_HOURS[key] ?? 12,
      })),
    )
    .onConflictDoNothing();

  // Default notification rules (Module 4.A thresholds).
  const deadlineRules = [
    { threshold: 7, priority: "low" as const },
    { threshold: 5, priority: "medium" as const },
    { threshold: 3, priority: "high" as const },
    { threshold: 2, priority: "high" as const },
    { threshold: 1, priority: "critical" as const },
    { threshold: 0, priority: "critical" as const },
  ];
  await db
    .insert(notificationRules)
    .values([
      ...deadlineRules.map((r) => ({
        businessId,
        ruleType: "deadline_reminder",
        threshold: r.threshold,
        priority: r.priority,
        enabled: true,
        recipientScope: "admins",
      })),
      {
        businessId,
        ruleType: "overdue_alert",
        threshold: null,
        priority: "critical" as const,
        enabled: true,
        recipientScope: "admins",
      },
      {
        businessId,
        ruleType: "delay_warning",
        threshold: null,
        priority: "high" as const,
        enabled: true,
        recipientScope: "admins",
      },
      {
        businessId,
        ruleType: "daily_summary",
        threshold: null,
        priority: "medium" as const,
        enabled: true,
        recipientScope: "admins",
      },
      {
        businessId,
        ruleType: "payment_due",
        threshold: 3,
        priority: "medium" as const,
        enabled: true,
        recipientScope: "billing",
      },
    ])
    .onConflictDoNothing();
}
