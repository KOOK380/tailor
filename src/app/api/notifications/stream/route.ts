import { getSession } from "@/lib/auth";
import { getDb } from "@/db/client";
import { notifications, notificationUserState } from "@/db/schema";
import { eq, and, or, gt, isNull, desc } from "drizzle-orm";

/**
 * Server-Sent Events stream for realtime notifications (Module 5).
 *
 * Polls the database every few seconds and emits rows created after the
 * client's last-seen timestamp. Works in both PGlite and Supabase modes;
 * swap for Supabase Realtime channels per the README if desired.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const sinceParam = url.searchParams.get("since");
  let lastSeen = sinceParam ? new Date(sinceParam) : new Date();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      send("connected", { ok: true });

      const tick = async () => {
        if (closed) return;
        try {
          const db = getDb();
          const rows = await db
            .select()
            .from(notifications)
            .leftJoin(
              notificationUserState,
              and(
                eq(notificationUserState.notificationId, notifications.id),
                eq(notificationUserState.userId, session.userId),
              ),
            )
            .where(
              and(
                eq(notifications.businessId, session.businessId),
                or(
                  eq(notifications.recipientUserId, session.userId),
                  eq(notifications.isBroadcast, true),
                )!,
                gt(notifications.createdAt, lastSeen),
              ),
            )
            .orderBy(desc(notifications.createdAt))
            .limit(20);

          if (rows.length > 0) {
            lastSeen = rows[0].notifications.createdAt;
            for (const row of rows) {
              // Skip if the user already dismissed this one (other tab).
              if (row.notification_user_state?.dismissedAt) continue;
              send("notification", {
                id: row.notifications.id,
                type: row.notifications.type,
                title: row.notifications.title,
                message: row.notifications.message,
                priority: row.notifications.priority,
                orderId: row.notifications.orderId,
                metadata: row.notifications.metadata,
                createdAt: row.notifications.createdAt.toISOString(),
                readAt: row.notification_user_state?.readAt?.toISOString() ?? null,
              });
            }
          }
        } catch (err) {
          // DB may be busy (PGlite single-connection) — skip this tick.
          void err;
        }
      };

      const timer = setInterval(tick, 4000);
      const ping = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`));
        } catch {
          closed = true;
        }
      }, 25000);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(timer);
        clearInterval(ping);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

void isNull;
