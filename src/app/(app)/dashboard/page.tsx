import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  Package,
  Receipt,
  TrendingUp,
  Users,
  Sparkles,
  Scissors,
  Hammer,
  Gem,
  Paintbrush,
  Shirt,
  CheckCircle2,
  Truck,
  Flame,
  Timer,
  DollarSign,
} from "lucide-react";
import { getSession } from "@/lib/auth";
import { getDashboardStats } from "@/server/dashboard";
import { getBusinessCurrency } from "@/server/business";
import { formatMoney } from "@/lib/currency";
import {
  StageDistributionChart,
  WorkloadChart,
  RevenueChart,
} from "@/components/dashboard/charts";
import { daysLeftBadge, deadlineBand } from "@/lib/deadline";
import { STAGE_LABELS, STAGE_ORDER } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

function StatCard({
  label,
  value,
  accent = "text-slate-900",
  icon: Icon = Package,
  chip = "chip-blue",
  href,
}: {
  label: string;
  value: number | string;
  accent?: string;
  icon?: React.ElementType;
  chip?: string;
  href?: string;
}) {
  const inner = (
    <div className="group rounded-2xl border border-slate-200/70 bg-white p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-soft-lg">
      <div className="flex items-center gap-2.5">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg transition-transform group-hover:scale-105",
            chip,
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
          {label}
        </p>
      </div>
      <p className={cn("mt-2.5 text-[26px] font-semibold leading-none tracking-tight", accent)}>
        {value}
      </p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default async function DashboardPage() {
  const session = (await getSession())!;
  const { stats, deadlineGroups, stageDistribution, employeeWorkload, delayedStages, recentCompleted } =
    await getDashboardStats();
  const currency = await getBusinessCurrency();

  const stageLabels = STAGE_LABELS as Record<string, string>;

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">
            Good to see you, {session.fullName.split(" ")[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Here&apos;s what needs your attention today.
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <StatCard label="Total Orders" value={stats.totalOrders} icon={Package} chip="chip-violet" href="/orders" />
        <StatCard label="New" value={stats.newOrders} accent="text-blue-600" icon={Sparkles} chip="chip-blue" href="/orders?status=new" />
        <StatCard label="In Production" value={stats.inProduction} accent="text-blue-600" icon={Timer} chip="chip-cyan" href="/orders?status=in_production" />
        {STAGE_ORDER.filter((k) => k !== "order_created" && k !== "finished").map((key) => {
          const stageMeta: Record<string, { icon: React.ElementType; chip: string }> = {
            cutting: { icon: Scissors, chip: "chip-blue" },
            designing: { icon: Paintbrush, chip: "chip-violet" },
            embroidery: { icon: Sparkles, chip: "chip-amber" },
            stone_crystals: { icon: Gem, chip: "chip-cyan" },
            hand_work: { icon: Hammer, chip: "chip-amber" },
            stitching: { icon: Shirt, chip: "chip-green" },
          };
          const meta = stageMeta[key] ?? { icon: Package, chip: "chip-blue" };
          return (
            <StatCard
              key={key}
              label={stageLabels[key]}
              value={stats.stageCounts[key] ?? 0}
              icon={meta.icon}
              chip={meta.chip}
              href={`/orders?stage=${key}`}
            />
          );
        })}
        <StatCard label="Ready for Delivery" value={stats.readyForDelivery} accent="text-green-600" icon={Truck} chip="chip-green" href="/orders?status=ready_for_delivery" />
        <StatCard label="Delivered" value={stats.delivered} icon={CheckCircle2} chip="chip-green" href="/orders?status=delivered" />
        <StatCard label="Urgent Orders" value={stats.urgentOrders} accent="text-orange-600" icon={Flame} chip="chip-amber" href="/orders?priority=urgent" />
        <StatCard label="Overdue Orders" value={stats.overdueOrders} accent="text-red-600" icon={AlertTriangle} chip="chip-red" />
        <StatCard label="Pending Payments" value={stats.pendingPayments} accent="text-orange-600" icon={DollarSign} chip="chip-amber" href="/billing" />
      </div>

      {/* Delivery Deadline Center */}
      <div className="mt-10">
        <div className="flex items-center gap-3">
          <div className="chip-blue flex h-9 w-9 items-center justify-center rounded-xl">
            <Clock className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight text-slate-900">
              Delivery Deadline Center
            </h2>
            <p className="text-xs text-slate-400">
              Orders grouped by time remaining
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-5">
          {deadlineGroups.length === 0 && (
            <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              No active orders — create an order to start tracking deadlines.
            </p>
          )}
          {deadlineGroups.map((group) => (
            <div key={group.key}>
              <div className="mb-2 flex items-center gap-2">
                <h3
                  className={cn(
                    "text-sm font-semibold",
                    group.key === "overdue"
                      ? "text-red-700"
                      : group.key === "today"
                        ? "text-red-600"
                        : "text-slate-700",
                  )}
                >
                  {group.label}
                </h3>
                <Badge variant="secondary">{group.orders.length}</Badge>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.orders.map((o) => {
                  const band = deadlineBand(o.daysLeft);
                  return (
                    <Link
                      key={o.id}
                      href={`/orders/${o.id}`}
                      className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-soft-lg"
                    >
                      <div className="flex items-start justify-between">
                        <p className="text-sm font-semibold text-blue-600">
                          {o.orderNumber}
                        </p>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium",
                            `badge-${band.key.replace(/_/g, "-")}`,
                          )}
                        >
                          {daysLeftBadge(o.daysLeft)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-slate-800">
                        {o.customerName}
                      </p>
                      <p className="truncate text-xs text-slate-500">{o.garment}</p>
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                        <span className="capitalize">{o.stage}</span>
                        <span>{o.employeeName ?? "Unassigned"}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${o.progressPercent}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {o.progressPercent}%
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize",
                            o.priority === "critical"
                              ? "bg-red-100 text-red-700"
                              : o.priority === "urgent"
                                ? "bg-orange-100 text-orange-700"
                                : o.priority === "high"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-slate-100 text-slate-600",
                          )}
                        >
                          {o.priority}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {o.deliveryDate}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts + lists */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="h-4 w-4 text-blue-600" />
              Stage Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StageDistributionChart data={stageDistribution} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-blue-600" />
              Employee Workload
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WorkloadChart data={employeeWorkload} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Payments This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-slate-900">
              {formatMoney(stats.monthlyRevenue, currency)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Outstanding balance: {formatMoney(stats.outstandingBalance, currency)}
            </p>
            <div className="mt-4">
              <RevenueChart
                currency={currency}
                data={[
                  { month: "This month", revenue: stats.monthlyRevenue },
                  { month: "Outstanding", revenue: stats.outstandingBalance },
                ]}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delayed production */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            Delayed Production ({delayedStages.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {delayedStages.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">
              No delayed stages — production is on schedule.
            </p>
          ) : (
            <div className="space-y-2">
              {delayedStages.slice(0, 8).map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-lg border border-orange-100 bg-orange-50/50 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {d.stageName} — #{d.orderNumber}
                    </p>
                    <p className="text-xs text-slate-500">
                      {d.employeeName ?? "Unassigned"}
                    </p>
                  </div>
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                    {d.days} day{d.days === 1 ? "" : "s"} behind
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent completed */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 text-green-600" />
            Recently Completed
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentCompleted.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">Nothing completed yet.</p>
          ) : (
            <div className="space-y-2">
              {recentCompleted.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
                >
                  <div>
                    <Link
                      href={`/orders/${r.id}`}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      #{r.orderNumber}
                    </Link>
                    <p className="text-xs text-slate-500">{r.customerName}</p>
                  </div>
                  <Badge variant="outline" className="border-green-300 text-green-700">
                    {r.deliveredAt ? r.deliveredAt.slice(0, 10) : "Ready"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
