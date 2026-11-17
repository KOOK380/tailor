import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Phone,
  Mail,
  MapPin,
  ArrowLeft,
  ClipboardList,
} from "lucide-react";
import { getCustomer, getCustomerHistory } from "@/server/customers";
import { getBusinessCurrency } from "@/server/business";
import { formatMoney } from "@/lib/currency";
import { CustomerForm } from "@/components/customers/customer-form";
import { MeasurementForm } from "@/components/customers/measurement-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { daysLeftBadge, daysRemaining, deadlineBand } from "@/lib/deadline";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  const { measurements, orders: customerOrders, invoices } =
    await getCustomerHistory(id);
  const currency = await getBusinessCurrency();

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/customers"
            className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to customers
          </Link>
          <h1 className="text-2xl font-semibold text-slate-900">
            {customer.fullName}
          </h1>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Phone className="h-4 w-4" />
              {customer.mobile}
            </span>
            {customer.altMobile && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-4 w-4" />
                {customer.altMobile}
              </span>
            )}
            {customer.email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="h-4 w-4" />
                {customer.email}
              </span>
            )}
            {customer.address && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {customer.address}
              </span>
            )}
          </div>
          {customer.notes && (
            <p className="mt-2 max-w-xl rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {customer.notes}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <CustomerForm
            mode="edit"
            initial={{
              id: customer.id,
              fullName: customer.fullName,
              mobile: customer.mobile,
              altMobile: customer.altMobile,
              email: customer.email,
              address: customer.address,
              trn: customer.trn,
              notes: customer.notes,
            }}
          />
          <Button render={<Link href={`/orders/new?customerId=${customer.id}`} />}>
            <ClipboardList className="mr-2 h-4 w-4" />
            New Order
          </Button>
        </div>
      </div>

      {/* Measurements */}
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Measurements ({measurements.length})
          </CardTitle>
          <MeasurementForm customerId={customer.id} />
        </CardHeader>
        <CardContent>
          {measurements.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">
              No measurements recorded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {measurements.map((m) => (
                <div
                  key={m.id}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">
                      {m.garmentType}
                    </span>
                    {m.label && <Badge variant="secondary">{m.label}</Badge>}
                    <span className="text-xs text-slate-400">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
                    {Object.entries(m.values as Record<string, string>).map(
                      ([k, v]) => (
                        <div key={k} className="flex justify-between text-sm">
                          <span className="capitalize text-slate-500">
                            {k.replace(/_/g, " ")}
                          </span>
                          <span className="font-medium text-slate-800">
                            {v || "—"}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                  {m.notes && (
                    <p className="mt-2 text-xs text-slate-500">{m.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order history */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
            Order History ({customerOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Garment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Priority</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customerOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-slate-500">
                    No orders yet.
                  </TableCell>
                </TableRow>
              )}
              {customerOrders.map((o) => {
                const days = daysRemaining(o.deliveryDate, "Asia/Kolkata");
                const band = deadlineBand(days);
                return (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Link
                        href={`/orders/${o.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {o.orderNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="capitalize">{o.currentStageKey.replace(/_/g, " ")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {o.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>{o.deliveryDate}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium badge-${band.key.replace(/_/g, "-")}`}
                      >
                        {o.status === "delivered" || o.status === "cancelled"
                          ? "—"
                          : daysLeftBadge(days)}
                      </span>
                    </TableCell>
                    <TableCell className="capitalize">{o.priority}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Invoices summary */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">
            Billing ({invoices.length} invoice{invoices.length === 1 ? "" : "s"})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-slate-500">
                    No invoices yet.
                  </TableCell>
                </TableRow>
              )}
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <Link
                      href={`/billing/${inv.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {inv.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{inv.issueDate}</TableCell>
                  <TableCell>{formatMoney(inv.total, currency)}</TableCell>
                  <TableCell>{formatMoney(inv.amountPaid, currency)}</TableCell>
                  <TableCell>{formatMoney(inv.balanceDue, currency)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {inv.status}
                    </Badge>
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
