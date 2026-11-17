import Link from "next/link";
import { PlusCircle, Search } from "lucide-react";
import { listOrders, type OrderListFilters } from "@/server/orders";
import { daysLeftBadge, daysRemaining, deadlineBand } from "@/lib/deadline";
import { STAGE_ORDER, STAGE_LABELS } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const PRIORITY_STYLES: Record<string, string> = {
  normal: "bg-slate-100 text-slate-700",
  high: "bg-blue-100 text-blue-700",
  urgent: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; priority?: string; stage?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const filters: OrderListFilters = {
    q: sp.q,
    status: sp.status,
    priority: sp.priority,
    stage: sp.stage,
    sort: sp.sort,
  };
  const rows = await listOrders(filters);

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Orders</h1>
          <p className="mt-1 text-sm text-slate-500">
            {rows.length} order{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button render={<Link href="/orders/new" />}>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Order
        </Button>
      </div>

      {/* Filters */}
      <form className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Search order #, customer…"
            className="w-64 pl-9"
          />
        </div>
        <Select name="status" defaultValue={sp.status ?? "all"}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="in_production">In Production</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
            <SelectItem value="finished">Finished</SelectItem>
            <SelectItem value="ready_for_delivery">Ready for Delivery</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select name="priority" defaultValue={sp.priority ?? "all"}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select name="stage" defaultValue={sp.stage ?? "all"}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {STAGE_ORDER.map((k) => (
              <SelectItem key={k} value={k}>
                {STAGE_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select name="sort" defaultValue={sp.sort ?? "priority"}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="priority">Priority first</SelectItem>
            <SelectItem value="delivery_asc">Delivery date ↑</SelectItem>
            <SelectItem value="newest">Newest first</SelectItem>
          </SelectContent>
        </Select>
        <Button type="submit" variant="outline">
          Apply
        </Button>
      </form>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Delivery</TableHead>
              <TableHead>Days Left</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-slate-500">
                  No orders match your filters.
                </TableCell>
              </TableRow>
            )}
            {rows.map(({ order, customerName, customerMobile }) => {
              const days = daysRemaining(order.deliveryDate, "Asia/Kolkata");
              const band = deadlineBand(days);
              const closed = order.status === "delivered" || order.status === "cancelled";
              return (
                <TableRow key={order.id}>
                  <TableCell>
                    <Link
                      href={`/orders/${order.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-slate-800">{customerName}</p>
                    <p className="text-xs text-slate-400">{customerMobile}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {(STAGE_LABELS as Record<string, string>)[order.currentStageKey] ??
                        order.currentStageKey}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${order.progressPercent}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500">{order.progressPercent}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{order.deliveryDate}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium badge-${band.key.replace(/_/g, "-")}`}
                    >
                      {closed ? "—" : daysLeftBadge(days)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium capitalize ${PRIORITY_STYLES[order.priority]}`}
                    >
                      {order.priority}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {order.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
