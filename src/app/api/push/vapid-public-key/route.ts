import { NextResponse } from "next/server";
import { vapidPublicKey } from "@/server/notifications/push";

export async function GET() {
  return NextResponse.json({
    publicKey: vapidPublicKey(),
    configured: Boolean(vapidPublicKey()),
  });
}
