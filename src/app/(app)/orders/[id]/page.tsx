import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Phone, User } from "lucide-react";
import { getOrderDetail, getOrderEmployees } from "@/server/orders";
import { getBusinessCurrency } from "@/server/business";
import { formatMoney } from "@/lib/currency";
import { daysLeftBadge, daysRemaining, deadlineBand, formatDeliveryDate } from "@/lib/deadline";
import { getSession } from "@/lib/auth";
import { StageTracker } from "@/components/orders/stage-tracker";
import { OrderActions } from "@/components/orders/order-actions";
import { OrderPaymentForm } from "@/components/orders/order-payment-form";
import { OrderImageUpload } from "@/components/orders/order-image-upload";
import { listOrderImages } from "@/server/storage";
import { LogoImg } from "@/components/billing/logo-img";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getOrderDetail(id);
  if (!detail) notFound();

  const session = (await getSession())!;
  const employees = await getOrderEmployees();
  const { order, customer, items, stages, payments } = detail;
  const currency = await getBusinessCurrency();
  const images = await listOrderImages(order.id);

  const orderValue = items.reduce(
    (s, i) => s + i.quantity * Number(i.unitPrice),
    0,
  );
  const paidTotal = payments.reduce((s, p) => s + Number(p.amount), 0);
  const balanceDue = Math.max(0, orderValue - paidTotal);

  const days = daysRemaining(order.deliveryDate, "Asia/Kolkata");
  const band = deadlineBand(days);
  const closed = order.status === "delivered" || order.status === "cancelled";

  return (
    <div className="p-6">
      <Link
        href="/orders"
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to orders
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">
              {order.orderNumber}
            </h1>
            <Badge variant="secondary" className="capitalize">
              {order.status.replace(/_/g, " ")}
            </Badge>
            <Badge
              variant="outline"
              className={`capitalize ${
                order.priority === "critical"
                  ? "border-red-300 text-red-700"
                  : order.priority === "urgent"
                    ? "border-orange-300 text-orange-700"
                    : order.priority === "high"
                      ? "border-blue-300 text-blue-700"
                      : ""
              }`}
            >
              {order.priority} priority
            </Badge>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1">
              <User className="h-4 w-4" />
              <Link
                href={`/customers/${customer.id}`}
                className="font-medium text-blue-600 hover:underline"
              >
                {customer.fullName}
              </Link>
            </span>
            <span className="inline-flex items-center gap-1">
              <Phone className="h-4 w-4" />
              {customer.mobile}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-4 w-4" />
              Delivery: {formatDeliveryDate(order.deliveryDate)}
              {order.deliveryTime ? ` at ${order.deliveryTime}` : ""}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {/* Days-left badge (Module 3) */}
          {!closed && (
            <span
              className={`inline-block rounded-full px-4 py-2 text-sm font-semibold badge-${band.key.replace(/_/g, "-")}`}
            >
              {daysLeftBadge(days)}
            </span>
          )}
          <span className="text-xs text-slate-400">{band.alert}</span>
          <OrderActions
            orderId={order.id}
            status={order.status}
            deliveryDate={order.deliveryDate}
            deliveryTime={order.deliveryTime}
            canManage={session.permissions.manageOrders}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Production workflow */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Where is this order in production?
              </CardTitle>
              <p className="text-xs text-slate-400">
                {order.progressPercent}% of the work is done — each garment moves
                through 8 stages from order to finished.
              </p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{ width: `${order.progressPercent}%` }}
                />
              </div>
            </CardHeader>
            <CardContent>
              <StageTracker
                stages={stages.map((s) => ({
                  id: s.id,
                  orderItemId: s.orderItemId,
                  stageKey: s.stageKey,
                  stageName: s.stageName,
                  sequence: s.sequence,
                  status: s.status,
                  assignedEmployeeId: s.assignedEmployeeId,
                  plannedStartDate: s.plannedStartDate,
                  plannedCompletionDate: s.plannedCompletionDate,
                  actualStartedAt: s.actualStartedAt
                    ? s.actualStartedAt.toISOString()
                    : null,
                  actualCompletedAt: s.actualCompletedAt
                    ? s.actualCompletedAt.toISOString()
                    : null,
                  estimatedDurationHours: s.estimatedDurationHours,
                  notes: s.notes,
                }))}
                employees={employees.map((e) => ({ id: e.id, fullName: e.fullName }))}
                canManage={
                  session.permissions.updateStages || session.permissions.manageOrders
                }
              />
            </CardContent>
          </Card>
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Garments ({items.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="font-medium text-slate-800">
                    {item.garmentType} ×{item.quantity}
                  </p>
                  {item.fabricDetails && (
                    <p className="text-xs text-slate-500">{item.fabricDetails}</p>
                  )}
                  {item.color && <p className="text-xs text-slate-500">Color: {item.color}</p>}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs capitalize text-slate-500">
                      {item.currentStageKey.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs font-medium text-slate-700">
                      {item.progressPercent}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-blue-400"
                      style={{ width: `${item.progressPercent}%` }}
                    />
                  </div>
                  {Number(item.unitPrice) > 0 && (
                    <p className="mt-1 text-xs text-slate-500">
                      {formatMoney(item.unitPrice, currency)} per unit
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {(order.designInstructions || order.notes) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Instructions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {order.designInstructions && (
                  <div>
                    <p className="text-xs font-medium text-slate-500">Design</p>
                    <p className="text-slate-700">{order.designInstructions}</p>
                  </div>
                )}
                {order.notes && (
                  <div>
                    <p className="text-xs font-medium text-slate-500">Notes</p>
                    <p className="text-slate-700">{order.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Order value</span>
                  <span className="font-medium text-slate-800">
                    {formatMoney(orderValue, currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Paid</span>
                  <span className="font-medium text-green-600">
                    {formatMoney(paidTotal, currency)}
                  </span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-1">
                  <span className="font-medium text-slate-700">Balance</span>
                  <span
                    className={cn(
                      "font-semibold",
                      balanceDue > 0 ? "text-orange-600" : "text-green-600",
                    )}
                  >
                    {formatMoney(balanceDue, currency)}
                  </span>
                </div>
              </div>

              {payments.length > 0 && (
                <div className="space-y-1.5 border-t border-slate-100 pt-2">
                  {payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-xs">
                      <div>
                        <p className="text-slate-700">
                          {formatMoney(p.amount, currency)} ·{" "}
                          <span className="capitalize">{p.method}</span>
                        </p>
                        <p className="text-slate-400">
                          {p.paidAt.toISOString().slice(0, 10)}
                          {p.reference ? ` · ${p.reference}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {session.permissions.manageBilling || session.permissions.manageOrders ? (
                <OrderPaymentForm
                  orderId={order.id}
                  balanceDue={balanceDue}
                  currency={currency}
                />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Reference Images ({images.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {images.map((img) => (
                    <a
                      key={img.id}
                      href={`/api/uploads/${img.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="group block overflow-hidden rounded-lg border border-slate-200"
                      title={img.fileName}
                    >
                      <LogoImg
                        src={`/api/uploads/${img.id}`}
                        alt={img.fileName}
                        className="h-20 w-full object-cover transition-transform group-hover:scale-105"
                      />
                    </a>
                  ))}
                </div>
              )}
              <OrderImageUpload orderId={order.id} />
              <p className="text-[11px] text-slate-400">
                Design references, fabric photos or customer samples — stored
                securely with the order.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Order date</span>
                <span className="text-slate-800">{order.orderDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Delivery date</span>
                <span className="text-slate-800">{order.deliveryDate}</span>
              </div>
              {order.deliveryTime && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Delivery time</span>
                  <span className="text-slate-800">{order.deliveryTime}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Payment</span>
                <Badge variant="outline" className="capitalize">
                  {order.paymentStatus}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
