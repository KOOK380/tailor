import Link from "next/link";
import { eq, and, inArray, ne, asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { orders, customers } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { daysRemaining, deadlineBand, daysLeftBadge } from "@/lib/deadline";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; year?: string; month?: string }>;
}) {
  const session = (await getSession())!;
  const sp = await searchParams;
  const view = sp.view ?? "month";
  const now = new Date();
  const year = Number(sp.year ?? now.getFullYear());
  const month = Number(sp.month ?? now.getMonth() + 1) - 1; // 0-based

  const db = getDb();
  const rows = await db
    .select({ order: orders, customerName: customers.fullName })
    .from(orders)
    .innerJoin(customers, eq(orders.customerId, customers.id))
    .where(
      and(
        eq(orders.businessId, session.businessId),
        inArray(orders.status, ["new", "in_production", "on_hold", "finished", "ready_for_delivery", "delivered"]),
      ),
    )
    .orderBy(asc(orders.deliveryDate));

  // Group orders by delivery date.
  const byDate = new Map<string, typeof rows>();
  for (const row of rows) {
    const arr = byDate.get(row.order.deliveryDate) ?? [];
    arr.push(row);
    byDate.set(row.order.deliveryDate, arr);
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  // Build month grid.
  const firstDay = new Date(Date.UTC(year, month, 1));
  const startWeekday = firstDay.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = now.toISOString().slice(0, 10);
  const prevMonth = month === 0 ? 12 : month;
  const prevYear = month === 0 ? year - 1 : year;
  const nextMonth = month === 11 ? 1 : month + 2;
  const nextYear = month === 11 ? year + 1 : year;

  function ColorDot({ daysLeft, status }: { daysLeft: number; status: string }) {
    const closed = status === "delivered" || status === "cancelled";
    const band = deadlineBand(daysLeft);
    const color =
      closed
        ? "bg-slate-300"
        : band.key === "overdue"
          ? "bg-red-800"
          : band.key === "due_today" || band.key === "critical" || band.key === "urgent"
            ? "bg-red-500"
            : band.key === "warning"
              ? "bg-orange-400"
              : band.key === "upcoming"
                ? "bg-yellow-400"
                : band.key === "early"
                  ? "bg-blue-400"
                  : "bg-green-400";
    return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", color)} />;
  }

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Delivery Calendar</h1>
          <p className="mt-1 text-sm text-slate-500">
            Order deadlines and scheduled deliveries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            href={`/calendar?view=${view}&year=${prevYear}&month=${prevMonth}`}
          >
            ← Prev
          </Link>
          <span className="min-w-[140px] text-center text-sm font-medium text-slate-800">
            {monthNames[month]} {year}
          </span>
          <Link
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            href={`/calendar?view=${view}&year=${nextYear}&month=${nextMonth}`}
          >
            Next →
          </Link>
          <Link
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            href={`/calendar?view=${view}&year=${now.getFullYear()}&month=${now.getMonth() + 1}`}
          >
            Today
          </Link>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-400" /> On schedule
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-blue-400" /> 7 days
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-yellow-400" /> 5–6 days
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-orange-400" /> 3–4 days
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" /> ≤ 2 days / due
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-800" /> Overdue
        </span>
      </div>

      {/* Month grid */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white">
        <div className="grid grid-cols-7 border-b border-slate-100">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="px-2 py-2 text-center text-xs font-medium text-slate-400">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((dateStr, i) => {
            const dayOrders = dateStr ? (byDate.get(dateStr) ?? []) : [];
            const isToday = dateStr === todayStr;
            return (
              <div
                key={i}
                className={cn(
                  "min-h-[110px] border-b border-r border-slate-50 p-1.5",
                  !dateStr && "bg-slate-50/50",
                  isToday && "bg-blue-50/60",
                )}
              >
                {dateStr && (
                  <>
                    <p
                      className={cn(
                        "text-xs font-medium",
                        isToday ? "text-blue-700" : "text-slate-500",
                      )}
                    >
                      {Number(dateStr.slice(8))}
                    </p>
                    <div className="mt-1 space-y-1">
                      {dayOrders.slice(0, 3).map(({ order, customerName }) => {
                        const days = daysRemaining(order.deliveryDate, "Asia/Kolkata");
                        return (
                          <Link
                            key={order.id}
                            href={`/orders/${order.id}`}
                            title={`${order.orderNumber} — ${customerName} — ${daysLeftBadge(days)}`}
                            className="flex items-center gap-1 rounded bg-white px-1 py-0.5 text-[10px] shadow-sm ring-1 ring-slate-100 hover:ring-blue-200"
                          >
                            <ColorDot daysLeft={days} status={order.status} />
                            <span className="truncate font-medium text-slate-700">
                              {order.orderNumber}
                            </span>
                            <span className="truncate text-slate-400">
                              {customerName.split(" ")[0]}
                            </span>
                          </Link>
                        );
                      })}
                      {dayOrders.length > 3 && (
                        <p className="px-1 text-[10px] text-slate-400">
                          +{dayOrders.length - 3} more
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming list (functions as week/day focus) */}
      <div className="mt-6">
        <h2 className="text-sm font-semibold text-slate-700">
          All scheduled deliveries
        </h2>
        <div className="mt-2 rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Order</th>
                <th className="px-4 py-2">Customer</th>
                <th className="px-4 py-2">Stage</th>
                <th className="px-4 py-2">Days</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No scheduled deliveries.
                  </td>
                </tr>
              )}
              {rows.map(({ order, customerName }) => {
                const days = daysRemaining(order.deliveryDate, "Asia/Kolkata");
                const band = deadlineBand(days);
                return (
                  <tr key={order.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-2 text-slate-600">{order.deliveryDate}</td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{customerName}</td>
                    <td className="px-4 py-2 capitalize text-slate-500">
                      {order.currentStageKey.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          "inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
                          `badge-${band.key.replace(/_/g, "-")}`,
                        )}
                      >
                        {order.status === "delivered" ? "—" : daysLeftBadge(days)}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className="capitalize">
                        {order.status.replace(/_/g, " ")}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

void ne;
