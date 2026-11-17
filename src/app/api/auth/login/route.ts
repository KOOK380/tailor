import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, createSession } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const result = await authenticate(parsed.data.email, parsed.data.password);
    if (!result) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    await createSession(result.userId, result.businessId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("login failed:", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
