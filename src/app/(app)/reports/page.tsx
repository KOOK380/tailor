import { Download } from "lucide-react";
import { getReports } from "@/server/reports";
import { getBusinessCurrency } from "@/server/business";
import { formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const data = await getReports(from, to);
  const currency = await getBusinessCurrency();

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Reports &amp; Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">
            Business performance across orders, production and revenue
          </p>
        </div>
        <a
          href={`/api/reports/export?from=${from ?? ""}&to=${to ?? ""}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </a>
      </div>

      {/* Date range filter */}
      <form className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-slate-500">From</label>
          <Input
            type="date"
            name="from"
            defaultValue={from ?? ""}
            className="mt-1 w-40"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">To</label>
          <Input
            type="date"
            name="to"
            defaultValue={to ?? ""}
            className="mt-1 w-40"
          />
        </div>
        <Button type="submit" variant="outline" size="sm">
          Apply
        </Button>
      </form>

      {/* KPI cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {[
          { label: "Total Orders", value: data.totalOrders, accent: "text-slate-900" },
          { label: "Completed", value: data.completedOrders, accent: "text-green-600" },
          { label: "Pending", value: data.pendingOrders, accent: "text-blue-600" },
          { label: "Overdue", value: data.overdueOrders, accent: "text-red-600" },
          {
            label: "On-Time Delivery",
            value: `${data.onTimeDeliveryPercent}%`,
            accent: "text-green-600",
          },
          {
            label: "Avg Production",
            value: `${data.avgProductionDays}d`,
            accent: "text-slate-900",
          },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{k.label}</p>
            <p className={cn("mt-1 text-2xl font-semibold", k.accent)}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Stage-wise processing time */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stage-wise Processing Time</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Avg hours</TableHead>
                  <TableHead className="text-right">Samples</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.stageWiseAvgHours.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-6 text-center text-slate-400">
                      No completed stages yet.
                    </TableCell>
                  </TableRow>
                )}
                {data.stageWiseAvgHours.map((s) => (
                  <TableRow key={s.stage}>
                    <TableCell>{s.stage}</TableCell>
                    <TableCell className="text-right">{s.avgHours}h</TableCell>
                    <TableCell className="text-right">{s.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Employee task completion */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Employee Task Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">In progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.employeeCompletion.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-6 text-center text-slate-400">
                      No employees.
                    </TableCell>
                  </TableRow>
                )}
                {data.employeeCompletion.map((e) => (
                  <TableRow key={e.name}>
                    <TableCell>{e.name}</TableCell>
                    <TableCell className="text-right text-green-600">
                      {e.completed}
                    </TableCell>
                    <TableCell className="text-right text-blue-600">
                      {e.inProgress}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Monthly revenue */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.monthlyRevenue.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="py-6 text-center text-slate-400">
                      No payments recorded.
                    </TableCell>
                  </TableRow>
                )}
                {data.monthlyRevenue.map((m) => (
                  <TableRow key={m.month}>
                    <TableCell>{m.month}</TableCell>
                    <TableCell className="text-right">
                      {formatMoney(m.revenue, currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-3 text-sm text-slate-500">
              Outstanding balance:{" "}
              <strong className="text-orange-600">
                {formatMoney(data.outstandingBalance, currency)}
              </strong>
            </p>
          </CardContent>
        </Card>

        {/* Delivery performance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivery Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">On-time deliveries</span>
                  <span className="font-medium text-green-600">
                    {data.onTimeDeliveryPercent}%
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-green-500"
                    style={{ width: `${data.onTimeDeliveryPercent}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Delayed deliveries</span>
                  <span className="font-medium text-red-600">
                    {data.delayedDeliveryPercent}%
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-red-500"
                    style={{ width: `${data.delayedDeliveryPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Order rows */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Orders in Range</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ordered</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead>Delivered</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>On time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.orderRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-slate-400">
                    No orders in this date range.
                  </TableCell>
                </TableRow>
              )}
              {data.orderRows.map((r) => (
                <TableRow key={r.orderNumber}>
                  <TableCell className="font-medium text-slate-800">
                    {r.orderNumber}
                  </TableCell>
                  <TableCell>{r.customerName}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {r.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.createdAt}</TableCell>
                  <TableCell>{r.deliveryDate}</TableCell>
                  <TableCell>{r.deliveredAt ?? "—"}</TableCell>
                  <TableCell>{r.progressPercent}%</TableCell>
                  <TableCell>
                    {r.onTime === null ? (
                      "—"
                    ) : r.onTime ? (
                      <span className="text-green-600">Yes</span>
                    ) : (
                      <span className="text-red-600">No</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
