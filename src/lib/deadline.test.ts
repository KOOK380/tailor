import { describe, it, expect } from "vitest";
import {
  daysRemaining,
  daysLeftBadge,
  deadlineBand,
  reminderTypesForDaysLeft,
  todayInTimezone,
  parseDateOnly,
  REMINDER_PRIORITY,
} from "./deadline";

describe("todayInTimezone", () => {
  it("returns YYYY-MM-DD in the business timezone", () => {
    // 2026-11-13 20:00 UTC = 2026-11-14 01:30 in Asia/Kolkata
    const now = new Date("2026-11-13T20:00:00Z");
    expect(todayInTimezone("Asia/Kolkata", now)).toBe("2026-11-14");
    expect(todayInTimezone("UTC", now)).toBe("2026-11-13");
  });
});

describe("daysRemaining", () => {
  const tz = "Asia/Kolkata";

  it("counts calendar days, not 24-hour periods", () => {
    // Late evening in Kolkata:23:30 IST = 18:00 UTC same day
    const lateNight = new Date("2026-11-18T18:00:00Z");
    expect(daysRemaining("2026-11-20", tz, lateNight)).toBe(2);
  });

  it("flips at local midnight", () => {
    // 18:29 UTC = 23:59 IST on Nov 18
    const before = new Date("2026-11-18T18:29:00Z");
    // 18:31 UTC = 00:01 IST on Nov 19
    const after = new Date("2026-11-18T18:31:00Z");
    expect(daysRemaining("2026-11-20", tz, before)).toBe(2);
    expect(daysRemaining("2026-11-20", tz, after)).toBe(1);
  });

  it("handles due today and overdue", () => {
    const now = new Date("2026-11-20T08:00:00+05:30");
    expect(daysRemaining("2026-11-20", tz, now)).toBe(0);
    expect(daysRemaining("2026-11-17", tz, now)).toBe(-3);
    expect(daysRemaining("2026-11-22", tz, now)).toBe(2);
  });
});

describe("daysLeftBadge", () => {
  it("matches spec badge examples", () => {
    expect(daysLeftBadge(12)).toBe("12 Days Left");
    expect(daysLeftBadge(7)).toBe("7 Days Left");
    expect(daysLeftBadge(3)).toBe("3 Days Left");
    expect(daysLeftBadge(1)).toBe("Only 1 Day Left!");
    expect(daysLeftBadge(0)).toBe("Due Today");
    expect(daysLeftBadge(-4)).toBe("Overdue by 4 Days");
    expect(daysLeftBadge(-1)).toBe("Overdue by 1 Day");
  });
});

describe("deadlineBand", () => {
  it("maps days remaining to the indicator table", () => {
    expect(deadlineBand(12).key).toBe("on_schedule");
    expect(deadlineBand(12).indicator).toBe("green");
    expect(deadlineBand(7).key).toBe("early");
    expect(deadlineBand(7).indicator).toBe("blue");
    expect(deadlineBand(6).key).toBe("upcoming");
    expect(deadlineBand(5).key).toBe("upcoming");
    expect(deadlineBand(6).indicator).toBe("yellow");
    expect(deadlineBand(4).key).toBe("warning");
    expect(deadlineBand(3).key).toBe("warning");
    expect(deadlineBand(4).indicator).toBe("orange");
    expect(deadlineBand(2).key).toBe("urgent");
    expect(deadlineBand(2).indicator).toBe("red");
    expect(deadlineBand(1).key).toBe("critical");
    expect(deadlineBand(0).key).toBe("due_today");
    expect(deadlineBand(-1).key).toBe("overdue");
    expect(deadlineBand(-1).indicator).toBe("dark-red");
    expect(deadlineBand(-5).key).toBe("overdue");
  });
});

describe("reminderTypesForDaysLeft", () => {
  it("fires the correct reminder types on threshold days", () => {
    expect(reminderTypesForDaysLeft(7).map((r) => r.type)).toEqual(["early_reminder"]);
    expect(reminderTypesForDaysLeft(5).map((r) => r.type)).toEqual(["upcoming_deadline"]);
    expect(reminderTypesForDaysLeft(3).map((r) => r.type)).toEqual(["warning"]);
    expect(reminderTypesForDaysLeft(2).map((r) => r.type)).toEqual(["urgent"]);
    expect(reminderTypesForDaysLeft(1).map((r) => r.type)).toEqual(["critical"]);
    expect(reminderTypesForDaysLeft(0).map((r) => r.type)).toEqual(["due_today"]);
  });

  it("fires nothing on non-threshold days", () => {
    expect(reminderTypesForDaysLeft(4)).toEqual([]);
    expect(reminderTypesForDaysLeft(6)).toEqual([]);
    expect(reminderTypesForDaysLeft(12)).toEqual([]);
  });

  it("overdue fires regardless of configured threshold days", () => {
    expect(reminderTypesForDaysLeft(-2, [7, 5]).map((r) => r.type)).toEqual(["overdue"]);
  });

  it("respects customized reminder days", () => {
    const custom = reminderTypesForDaysLeft(7, [10, 4]);
    expect(custom).toEqual([]);
    expect(reminderTypesForDaysLeft(4, [10, 4]).map((r) => r.type)).toEqual(["warning"]);
  });

  it("always fires due_today even if 0 is not configured", () => {
    expect(reminderTypesForDaysLeft(0, [7, 3]).map((r) => r.type)).toEqual(["due_today"]);
  });
});

describe("REMINDER_PRIORITY", () => {
  it("matches spec priorities", () => {
    expect(REMINDER_PRIORITY.early_reminder).toBe("low");
    expect(REMINDER_PRIORITY.upcoming_deadline).toBe("medium");
    expect(REMINDER_PRIORITY.warning).toBe("high");
    expect(REMINDER_PRIORITY.urgent).toBe("high");
    expect(REMINDER_PRIORITY.critical).toBe("critical");
    expect(REMINDER_PRIORITY.due_today).toBe("critical");
    expect(REMINDER_PRIORITY.overdue).toBe("critical");
  });
});

describe("parseDateOnly", () => {
  it("parses as UTC midnight", () => {
    expect(parseDateOnly("2026-11-20")).toBe(Date.UTC(2026, 10, 20));
  });
});
