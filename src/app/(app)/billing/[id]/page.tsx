import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { getInvoiceDetail } from "@/server/billing";
import { getBusinessProfile, getBusinessCurrency } from "@/server/business";
import { formatMoney, currencySymbol } from "@/lib/currency";
import { PaymentForm } from "@/components/billing/invoice-form";
import { PrintButton } from "@/components/billing/print-button";
import { LogoImg } from "@/components/billing/logo-img";
import { Badge } from "@/components/ui/badge";

/** Bilingual (English + Arabic) label pair — standard GCC tax invoice style. */
function Bi({
  en,
  ar,
  align = "left",
  strong = false,
}: {
  en: string;
  ar: string;
  align?: "left" | "right";
  strong?: boolean;
}) {
  return (
    <span className={`inline-block ${align === "right" ? "text-right" : ""}`}>
      <span className={strong ? "font-semibold" : ""}>{en}</span>
      <span
        dir="rtl"
        className="mt-px block text-[10px] leading-tight text-slate-400"
        style={{ fontFamily: "'Segoe UI', 'Geeza Pro', 'Noto Naskh Arabic', sans-serif" }}
      >
        {ar}
      </span>
    </span>
  );
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getInvoiceDetail(id);
  if (!detail) notFound();
  const { invoice, customer, orderNumber, payments } = detail;
  const currency = await getBusinessCurrency();
  const biz = await getBusinessProfile();

  const lines =
    (invoice.items as { description: string; quantity: number; unitPrice: number }[]) ?? [];

  const totalExclVat =
    Number(invoice.subtotal) -
    Number(invoice.discountAmount) +
    Number(invoice.additionalCharges);

  return (
    <div className="p-6">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/billing"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to billing
        </Link>
        <div className="flex gap-2">
          <a
            href={`/api/billing/${invoice.id}/pdf`}
            download
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </a>
          <PrintButton />
          {Number(invoice.balanceDue) > 0 && (
            <PaymentForm
              invoiceId={invoice.id}
              balanceDue={Number(invoice.balanceDue)}
              currency={currency}
            />
          )}
        </div>
      </div>

      {/* ---- Standard Tax Invoice (bilingual EN/AR) ---- */}
      <div
        className="print-page mx-auto max-w-3xl border border-slate-200 bg-white px-12 py-10 text-slate-900"
        style={{ fontFamily: "'Segoe UI', 'Geeza Pro', 'Noto Naskh Arabic', sans-serif" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden border border-slate-200">
              <LogoImg
                src="/api/business/logo"
                alt={biz.name}
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <p className="text-[17px] font-bold leading-tight text-slate-900">
                {biz.name}
              </p>
              {biz.address && (
                <p className="mt-1 max-w-[260px] text-xs leading-relaxed text-slate-500">
                  {biz.address}
                </p>
              )}
              <p className="mt-0.5 text-xs text-slate-500">
                {[biz.phone, biz.email].filter(Boolean).join("  ·  ")}
              </p>
              {biz.trn && (
                <p className="mt-1.5 text-xs">
                  <span className="text-slate-500">TRN: </span>
                  <span className="font-semibold tracking-wide text-slate-900">
                    {biz.trn}
                  </span>
                  <span
                    dir="rtl"
                    className="ml-2 text-[10px] text-slate-400"
                    style={{ fontFamily: "'Segoe UI', 'Geeza Pro', sans-serif" }}
                  >
                    الرقم الضريبي
                  </span>
                </p>
              )}
            </div>
          </div>

          <div className="text-right">
            <h1 className="text-[22px] font-bold tracking-[0.12em] text-slate-900">
              TAX INVOICE
            </h1>
            <p
              dir="rtl"
              className="mt-0.5 text-[15px] font-semibold text-slate-900"
              style={{ fontFamily: "'Segoe UI', 'Geeza Pro', sans-serif" }}
            >
              فاتورة ضريبية
            </p>
            <div className="mt-3 space-y-0.5 text-xs text-slate-600">
              <p>
                <span className="text-slate-400">Invoice No: </span>
                <span className="font-semibold text-slate-900">
                  {invoice.invoiceNumber}
                </span>
              </p>
              <p>
                <span className="text-slate-400">Invoice Date: </span>
                {invoice.issueDate}
              </p>
              <p>
                <span className="text-slate-400">Due Date: </span>
                {invoice.dueDate ?? "—"}
              </p>
              {orderNumber && (
                <p>
                  <span className="text-slate-400">Order No: </span>
                  {orderNumber}
                </p>
              )}
            </div>
            <Badge
              variant="outline"
              className={`mt-2 capitalize ${
                invoice.status === "paid"
                  ? "border-green-300 text-green-700"
                  : invoice.status === "partial"
                    ? "border-orange-300 text-orange-700"
                    : ""
              }`}
            >
              {invoice.status}
            </Badge>
          </div>
        </div>

        <div className="mt-6 border-t-2 border-slate-800" />

        {/* Bill To */}
        <div className="mt-5 flex items-start justify-between gap-8">
          <div>
            <Bi en="Bill To" ar="بيانات العميل" strong />
            <p className="mt-1.5 text-sm font-semibold text-slate-900">
              {customer.fullName}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{customer.mobile}</p>
            {customer.altMobile && (
              <p className="text-xs text-slate-400">Alt: {customer.altMobile}</p>
            )}
            {customer.address && (
              <p className="mt-0.5 max-w-[280px] text-xs leading-relaxed text-slate-500">
                {customer.address}
              </p>
            )}
          </div>
          <div className="text-right">
            <Bi en="Customer TRN" ar="الرقم الضريبي للعميل" align="right" strong />
            <p className="mt-1.5 text-sm font-semibold tracking-wide text-slate-900">
              {customer.trn ?? "—"}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              <Bi en="Currency" ar="العملة" align="right" />{" "}
              <span className="font-medium text-slate-700">
                {currency} ({currencySymbol(currency)})
              </span>
            </p>
          </div>
        </div>

        {/* Items */}
        <table className="mt-7 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-slate-800">
              <th className="w-8 py-2.5 text-left align-bottom text-xs font-semibold uppercase tracking-wide text-slate-600">
                #
              </th>
              <th className="py-2.5 text-left align-bottom">
                <Bi en="Description" ar="البيان" strong />
              </th>
              <th className="w-16 py-2.5 text-right align-bottom">
                <Bi en="Qty" ar="الكمية" align="right" strong />
              </th>
              <th className="w-28 py-2.5 text-right align-bottom">
                <Bi en="Unit Price" ar="سعر الوحدة" align="right" strong />
              </th>
              <th className="w-32 py-2.5 text-right align-bottom">
                <Bi en="Amount" ar="المبلغ" align="right" strong />
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="border-b border-slate-200">
                <td className="py-2.5 text-xs text-slate-400">{i + 1}</td>
                <td className="py-2.5 text-slate-800">{line.description}</td>
                <td className="py-2.5 text-right text-slate-800">{line.quantity}</td>
                <td className="py-2.5 text-right text-slate-800">
                  {formatMoney(line.unitPrice, currency)}
                </td>
                <td className="py-2.5 text-right text-slate-800">
                  {formatMoney(line.quantity * line.unitPrice, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="ml-auto mt-5 w-72 text-sm">
          <div className="flex items-start justify-between py-1 text-slate-600">
            <Bi en="Subtotal" ar="الإجمالي الفرعي" />
            <span>{formatMoney(invoice.subtotal, currency)}</span>
          </div>
          <div className="flex items-start justify-between py-1 text-slate-600">
            <Bi
              en={`Discount ${invoice.discountType === "percent" ? `(${invoice.discountValue}%)` : ""}`}
              ar="الخصم"
            />
            <span>- {formatMoney(invoice.discountAmount, currency)}</span>
          </div>
          {Number(invoice.additionalCharges) > 0 && (
            <div className="flex items-start justify-between py-1 text-slate-600">
              <Bi
                en={invoice.additionalChargesLabel || "Additional charges"}
                ar="رسوم إضافية"
              />
              <span>{formatMoney(invoice.additionalCharges, currency)}</span>
            </div>
          )}
          <div className="mt-1 flex items-start justify-between border-t border-slate-300 py-1.5 text-slate-700">
            <Bi en="Total (excl. VAT)" ar="الإجمالي بدون ضريبة" />
            <span>{formatMoney(totalExclVat, currency)}</span>
          </div>
          <div className="flex items-start justify-between py-1 text-slate-600">
            <Bi
              en={`${invoice.taxLabel ?? "VAT"} (${invoice.taxRate}%)`}
              ar="ضريبة القيمة المضافة"
            />
            <span>{formatMoney(invoice.taxAmount, currency)}</span>
          </div>
          <div className="mt-1 flex items-start justify-between border-t-4 border-double border-slate-800 py-2 text-base font-bold text-slate-900">
            <Bi en="Total (incl. VAT)" ar="الإجمالي شامل الضريبة" strong />
            <span>{formatMoney(invoice.total, currency)}</span>
          </div>
          <div className="flex items-start justify-between border-b border-slate-200 py-1 text-slate-600">
            <Bi en="Amount Paid" ar="المبلغ المدفوع" />
            <span>{formatMoney(invoice.amountPaid, currency)}</span>
          </div>
          <div className="flex items-start justify-between py-1.5 font-semibold text-slate-900">
            <Bi en="Balance Due" ar="المبلغ المتبقي" strong />
            <span>{formatMoney(invoice.balanceDue, currency)}</span>
          </div>
        </div>

        {/* Payment history */}
        {payments.length > 0 && (
          <div className="mt-8">
            <Bi en="Payment history" ar="سجل المدفوعات" strong />
            <table className="mt-2 w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="py-1.5 text-left font-semibold text-slate-500">
                    <Bi en="Date" ar="التاريخ" />
                  </th>
                  <th className="py-1.5 text-left font-semibold text-slate-500">
                    <Bi en="Method" ar="طريقة الدفع" />
                  </th>
                  <th className="py-1.5 text-left font-semibold text-slate-500">
                    <Bi en="Reference" ar="المرجع" />
                  </th>
                  <th className="py-1.5 text-right font-semibold text-slate-500">
                    <Bi en="Amount" ar="المبلغ" align="right" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="py-1.5 text-slate-600">
                      {p.paidAt.toISOString().slice(0, 10)}
                    </td>
                    <td className="py-1.5 capitalize text-slate-600">{p.method}</td>
                    <td className="py-1.5 text-slate-600">{p.reference ?? "—"}</td>
                    <td className="py-1.5 text-right text-slate-700">
                      {formatMoney(p.amount, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Notes / Terms */}
        <div className="mt-8 border-t border-slate-200 pt-4">
          <Bi en="Notes" ar="ملاحظات" strong />
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {invoice.notes ?? "Payment is due by the invoice due date."}
          </p>
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-end justify-between">
          <p className="text-[10px] text-slate-400">
            This is a computer-generated tax invoice ·{" "}
            <span dir="rtl" style={{ fontFamily: "'Segoe UI', 'Geeza Pro', sans-serif" }}>
              فاتورة ضريبية إلكترونية
            </span>
          </p>
          <p className="text-xs font-medium text-slate-600">
            Thank you ·{" "}
            <span dir="rtl" style={{ fontFamily: "'Segoe UI', 'Geeza Pro', sans-serif" }}>
              شكراً لكم
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
