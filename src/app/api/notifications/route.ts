import { NextResponse } from "next/server";
import {
  listNotifications,
  updateNotificationState,
  markAllRead,
  type NotificationAction,
} from "@/server/notifications/queries";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const filter = url.searchParams.get("filter") ?? "all";
  const limit = Number(url.searchParams.get("limit") ?? 20);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  try {
    const result = await listNotifications(filter, limit, offset);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[notifications] list failed:", err);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { notificationId, action, snoozeMinutes, markAll } = body as {
      notificationId?: string;
      action?: NotificationAction;
      snoozeMinutes?: number;
      markAll?: boolean;
    };

    if (markAll) {
      await markAllRead();
      return NextResponse.json({ ok: true });
    }
    if (!notificationId || !action) {
      return NextResponse.json({ error: "Missing params" }, { status: 400 });
    }
    const result = await updateNotificationState(
      notificationId,
      action,
      snoozeMinutes,
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[notifications] update failed:", err);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
