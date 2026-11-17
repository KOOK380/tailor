import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/db/client";
import { pushSubscriptions } from "@/db/schema";
import { requireSession } from "@/lib/auth";

const schema = z.object({
  deviceIdentifier: z.string().min(4),
  subscription: z.object({
    endpoint: z.string().url(),
    expirationTime: z.number().nullable().optional(),
    keys: z.object({ p256dh: z.string(), auth: z.string() }),
  }),
  userAgent: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }
    const { deviceIdentifier, subscription, userAgent } = parsed.data;
    const db = getDb();

    await db
      .insert(pushSubscriptions)
      .values({
        businessId: session.businessId,
        userId: session.userId,
        deviceIdentifier,
        endpoint: subscription.endpoint,
        encryptedSubscriptionDetails: subscription,
        userAgent: userAgent ?? null,
        lastUsedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          encryptedSubscriptionDetails: subscription,
          deviceIdentifier,
          lastUsedAt: new Date(),
        },
      });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[push] subscribe failed:", err);
    return NextResponse.json({ error: "Subscribe failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint");
    const db = getDb();
    if (endpoint) {
      await db
        .delete(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.endpoint, endpoint),
            eq(pushSubscriptions.userId, session.userId),
          ),
        );
    } else {
      // Unsubscribe all devices of this user.
      await db
        .delete(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, session.userId));
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[push] unsubscribe failed:", err);
    return NextResponse.json({ error: "Unsubscribe failed" }, { status: 500 });
  }
}
