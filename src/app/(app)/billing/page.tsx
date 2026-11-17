import Link from "next/link";
import { listInvoices } from "@/server/billing";
import { getSession } from "@/lib/auth";
import { getBusinessCurrency } from "@/server/business";
import { formatMoney } from "@/lib/currency";
import { InvoiceForm } from "@/components/billing/invoice-form";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getDb } from "@/db/client";
import { customers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getSession();
  if (!session?.permissions.manageBilling) {
    redirect("/dashboard");
  }
  const { status } = await searchParams;
  const rows = await listInvoices(status);
  const currency = await getBusinessCurrency();

  const db = getDb();
  const customerRows = await db
    .select()
    .from(customers)
    .where(eq(customers.businessId, session.businessId));

  const totals = rows.reduce(
    (acc, r) => ({
      billed: acc.billed + Number(r.invoice.total),
      collected: acc.collected + Number(r.invoice.amountPaid),
      outstanding: acc.outstanding + Number(r.invoice.balanceDue),
    }),
    { billed: 0, collected: 0, outstanding: 0 },
  );

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Billing</h1>
          <p className="mt-1 text-sm text-slate-500">
            {rows.length} invoice{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        <InvoiceForm
          customers={customerRows.map((c) => ({ id: c.id, fullName: c.fullName }))}
          currency={currency}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Total billed</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {formatMoney(totals.billed, currency)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Collected</p>
          <p className="mt-1 text-2xl font-semibold text-green-600">
            {formatMoney(totals.collected, currency)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Outstanding balance</p>
          <p className="mt-1 text-2xl font-semibold text-orange-600">
            {formatMoney(totals.outstanding, currency)}
          </p>
        </div>
      </div>

      <form className="mt-4 flex items-center gap-2">
        <Select name="status" defaultValue={status ?? "all"}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="issued">Issued</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </form>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-12 text-center text-slate-500">
                  No invoices yet. Create one to get started.
                </TableCell>
              </TableRow>
            )}
            {rows.map(({ invoice, customerName, orderNumber }) => (
              <TableRow key={invoice.id}>
                <TableCell>
                  <Link
                    href={`/billing/${invoice.id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {invoice.invoiceNumber}
                  </Link>
                </TableCell>
                <TableCell>{customerName}</TableCell>
                <TableCell className="text-slate-500">{orderNumber ?? "—"}</TableCell>
                <TableCell>{invoice.issueDate}</TableCell>
                <TableCell>{formatMoney(invoice.total, currency)}</TableCell>
                <TableCell>{formatMoney(invoice.amountPaid, currency)}</TableCell>
                <TableCell className="font-medium">
                  {formatMoney(invoice.balanceDue, currency)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`capitalize ${
                      invoice.status === "paid"
                        ? "border-green-300 text-green-700"
                        : invoice.status === "partial"
                          ? "border-orange-300 text-orange-700"
                          : ""
                    }`}
                  >
                    {invoice.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
