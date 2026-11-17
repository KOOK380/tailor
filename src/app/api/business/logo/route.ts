import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { saveBusinessLogo, getBusinessLogo } from "@/server/storage";

/**
 * Business logo (Module 10 — GCC invoice design).
 * POST: upload logo image (png/jpg/webp/svg, max 2MB) — stored in the
 *       database so it survives serverless redeploys (Neon / Supabase).
 * GET:  serve the current business's logo for invoice rendering.
 */
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    if (!session.permissions.manageSettings) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }
    const result = await saveBusinessLogo(session.businessId, {
      name: file.name,
      type: file.type,
      data: Buffer.from(await file.arrayBuffer()),
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[logo] upload failed:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await requireSession();
    const logo = await getBusinessLogo(session.businessId);
    if (!logo) {
      return new Response("Not found", { status: 404 });
    }
    return new Response(new Uint8Array(logo.data), {
      headers: {
        "Content-Type": logo.mimeType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
