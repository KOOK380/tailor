import { NextResponse } from "next/server";
import { z } from "zod";
import { registerBusiness, createSession } from "@/lib/auth";
import { initializeBusiness } from "@/server/bootstrap";

const schema = z.object({
  businessName: z.string().min(2),
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { businessId, userId } = await registerBusiness(parsed.data);
    // Seed stage definitions, default notification rules and settings.
    await initializeBusiness(businessId);
    await createSession(userId, businessId);
    return NextResponse.json({ ok: true, businessId });
  } catch (err) {
    console.error("register failed:", err);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
