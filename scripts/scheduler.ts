/**
 * Local notification scheduler (Module 5 — server-side scheduled jobs).
 *
 * Runs the notification sweep on an interval so deadline reminders keep
 * generating even when nobody has the website open. In production this role
 * is played by Vercel Cron hitting /api/cron/deadline-check.
 *
 *   npm run scheduler
 *
 * Interval is configurable: SCHEDULER_INTERVAL_MINUTES (default 15).
 */
import { runNotificationSweep } from "../src/server/notifications/scheduler";

const INTERVAL_MINUTES = Number(process.env.SCHEDULER_INTERVAL_MINUTES ?? 15);
const INTERVAL_MS = Math.max(1, INTERVAL_MINUTES) * 60 * 1000;

console.log(
  `[scheduler] notification scheduler started — sweep every ${INTERVAL_MINUTES} minute(s)`,
);

let running = false;

async function tick() {
  if (running) {
    console.log("[scheduler] previous sweep still running — skipping");
    return;
  }
  running = true;
  try {
    const result = await runNotificationSweep();
    console.log(
      `[scheduler] sweep done — deadline: ${result.deadline}, delay: ${result.delay}, summary: ${result.summary}, tasks: ${result.overdue}`,
    );
  } catch (err) {
    console.error("[scheduler] sweep failed:", err);
  } finally {
    running = false;
  }
}

// First run immediately, then on interval.
tick();
const timer = setInterval(tick, INTERVAL_MS);

process.on("SIGINT", () => {
  clearInterval(timer);
  console.log("[scheduler] stopped");
  process.exit(0);
});
