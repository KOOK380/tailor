import { NextResponse } from "next/server";
import { runNotificationSweep } from "@/server/notifications/scheduler";

/**
 * Scheduled deadline check endpoint (Module 5).
 *
 * Production: Vercel Cron calls this hourly (see vercel.json), authenticated
 * with the CRON_SECRET environment variable.
 * Local: `npm run scheduler` posts here (or calls the sweep directly).
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const provided = authHeader?.replace("Bearer ", "") ?? req.headers.get("x-cron-secret");

  // In development, allow unauthenticated runs for easy testing.
  if (process.env.NODE_ENV === "production") {
    if (!secret || provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runNotificationSweep();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron] deadline-check failed:", err);
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 });
  }
}

export async function GET() {
  // Allow GET for manual browser triggering in development.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Use POST" }, { status: 405 });
  }
  const result = await runNotificationSweep();
  return NextResponse.json({ ok: true, ...result });
}
