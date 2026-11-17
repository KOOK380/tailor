import { exportOrdersCsv } from "@/server/reports";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  try {
    const csv = await exportOrdersCsv(from, to);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="orders-report-${from ?? "all"}-to-${to ?? "today"}.csv"`,
      },
    });
  } catch {
    return new Response("Export failed", { status: 500 });
  }
}
