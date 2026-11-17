/**
 * Timezone-aware delivery deadline calculations (Module 3).
 *
 * Days Remaining = Delivery Calendar Date − Current Calendar Date, both
 * evaluated in the business timezone (default Asia/Kolkata). Calendar-date
 * arithmetic — not 24-hour arithmetic — so the countdown flips exactly at
 * local midnight.
 */

export interface DeadlineBand {
  key: "on_schedule" | "early" | "upcoming" | "warning" | "urgent" | "critical" | "due_today" | "overdue";
  label: string; // badge text
  indicator: string; // green | blue | yellow | orange | red | dark-red
  alert: string; // On Schedule | Early Reminder | ...
  /** Accent color token used by the UI. */
  color: "green" | "blue" | "yellow" | "orange" | "red" | "darkRed";
}

/** Default thresholds from the spec; admins may customize (business_settings.reminder_days). */
export const DEFAULT_REMINDER_DAYS = [7, 5, 3, 2, 1];

export interface DeadlineThresholds {
  /** Days before delivery that still count as "on schedule" (> this = green). */
  onScheduleAbove: number; // 7
  earlyDays: number; // 7
  upcomingMin: number; // 5
  upcomingMax: number; // 6
  warningMin: number; // 3
  warningMax: number; // 4
  urgentDays: number; // 2
  criticalDays: number; // 1
}

export const DEFAULT_THRESHOLDS: DeadlineThresholds = {
  onScheduleAbove: 7,
  earlyDays: 7,
  upcomingMin: 5,
  upcomingMax: 6,
  warningMin: 3,
  warningMax: 4,
  urgentDays: 2,
  criticalDays: 1,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Current calendar date (YYYY-MM-DD) in the given IANA timezone. */
export function todayInTimezone(timeZone: string, now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Parse YYYY-MM-DD into UTC midnight — safe for day-distance math. */
export function parseDateOnly(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/**
 * Calendar days remaining until delivery, in business timezone.
 * Positive = days left, 0 = due today, negative = overdue by that many days.
 */
export function daysRemaining(
  deliveryDate: string,
  timeZone: string,
  now: Date = new Date(),
): number {
  const today = todayInTimezone(timeZone, now);
  return Math.round((parseDateOnly(deliveryDate) - parseDateOnly(today)) / MS_PER_DAY);
}

/** Badge text per the spec examples. */
export function daysLeftBadge(daysLeft: number): string {
  if (daysLeft > 1) return `${daysLeft} Days Left`;
  if (daysLeft === 1) return "Only 1 Day Left!";
  if (daysLeft === 0) return "Due Today";
  const overdue = Math.abs(daysLeft);
  return `Overdue by ${overdue} Day${overdue === 1 ? "" : "s"}`;
}

/** Map days-remaining onto the indicator table (Module 3). */
export function deadlineBand(
  daysLeft: number,
  t: DeadlineThresholds = DEFAULT_THRESHOLDS,
): DeadlineBand {
  if (daysLeft < 0) {
    return {
      key: "overdue",
      label: daysLeftBadge(daysLeft),
      indicator: "dark-red",
      alert: "Overdue",
      color: "darkRed",
    };
  }
  if (daysLeft === 0) {
    return {
      key: "due_today",
      label: "Due Today",
      indicator: "red",
      alert: "Due Today",
      color: "red",
    };
  }
  if (daysLeft === t.criticalDays) {
    return {
      key: "critical",
      label: daysLeftBadge(daysLeft),
      indicator: "red",
      alert: "Critical",
      color: "red",
    };
  }
  if (daysLeft === t.urgentDays) {
    return {
      key: "urgent",
      label: daysLeftBadge(daysLeft),
      indicator: "red",
      alert: "Urgent",
      color: "red",
    };
  }
  if (daysLeft >= t.warningMin && daysLeft <= t.warningMax) {
    return {
      key: "warning",
      label: daysLeftBadge(daysLeft),
      indicator: "orange",
      alert: "Warning",
      color: "orange",
    };
  }
  if (daysLeft >= t.upcomingMin && daysLeft <= t.upcomingMax) {
    return {
      key: "upcoming",
      label: daysLeftBadge(daysLeft),
      indicator: "yellow",
      alert: "Upcoming",
      color: "yellow",
    };
  }
  if (daysLeft === t.earlyDays) {
    return {
      key: "early",
      label: daysLeftBadge(daysLeft),
      indicator: "blue",
      alert: "Early Reminder",
      color: "blue",
    };
  }
  return {
    key: "on_schedule",
    label: daysLeftBadge(daysLeft),
    indicator: "green",
    alert: "On Schedule",
    color: "green",
  };
}

/**
 * Which scheduled reminder types fire today for an order with `daysLeft`.
 * Reminder day thresholds are configurable per business; any configured day
 * maps onto the deadline band it belongs to (so e.g. day 4 → "warning").
 */
export function reminderTypesForDaysLeft(
  daysLeft: number,
  reminderDays: number[] = DEFAULT_REMINDER_DAYS,
): { type: ReminderType; days: number }[] {
  const out: { type: ReminderType; days: number }[] = [];
  const BAND_TO_TYPE: Record<string, ReminderType> = {
    on_schedule: "early_reminder",
    early: "early_reminder",
    upcoming: "upcoming_deadline",
    warning: "warning",
    urgent: "urgent",
    critical: "critical",
    due_today: "due_today",
    overdue: "overdue",
  };
  if (daysLeft < 0) {
    out.push({ type: "overdue", days: daysLeft });
    return out;
  }
  for (const d of reminderDays) {
    if (d === daysLeft) {
      const type = BAND_TO_TYPE[deadlineBand(d).key];
      if (type) out.push({ type, days: d });
    }
  }
  // Delivery day always fires (even if 0 isn't in the configured list).
  if (daysLeft === 0 && !out.some((r) => r.type === "due_today")) {
    out.push({ type: "due_today", days: 0 });
  }
  return out;
}

export type ReminderType =
  | "early_reminder"
  | "upcoming_deadline"
  | "warning"
  | "urgent"
  | "critical"
  | "due_today"
  | "overdue";

export const REMINDER_PRIORITY: Record<ReminderType, "low" | "medium" | "high" | "critical"> = {
  early_reminder: "low",
  upcoming_deadline: "medium",
  warning: "high",
  urgent: "high",
  critical: "critical",
  due_today: "critical",
  overdue: "critical",
};

/** Format a date (YYYY-MM-DD) for display, e.g. "20 November 2026". */
export function formatDeliveryDate(dateStr: string, timeZone = "UTC"): string {
  const d = new Date(parseDateOnly(dateStr) + MS_PER_DAY / 2);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}
