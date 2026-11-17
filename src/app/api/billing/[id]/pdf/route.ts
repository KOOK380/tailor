import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getInvoiceDetail } from "@/server/billing";
import { getBusinessCurrency } from "@/server/business";
import { getBusinessLogo } from "@/server/storage";
import { formatMoneyPlain } from "@/lib/currency";
import { getDb } from "@/db/client";
import { businesses } from "@/db/schema";
// Bidi + shaping for Arabic runs (keeps amounts in order inside RTL lines).
import { drawArabicText } from "arabic-bidi-shaper/pdf-lib";

/**
 * Standard UAE/GCC Tax Invoice PDF (Module 10) — classic accounting layout:
 * thin rules instead of fills, bordered items table, right-aligned totals
 * with a double-ruled grand total. Bilingual EN/AR labels, logo, TRNs.
 *
 * Vertical geometry rule: every bilingual pair is EN baseline → AR baseline
 * 11pt below (AR bottom ≈ −14). Rules keep ≥ 3pt from any glyph box; rows
 * are pitched so nothing can collide.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const detail = await getInvoiceDetail(id);
  if (!detail) {
    return new Response("Not found", { status: 404 });
  }
  const { invoice, customer, orderNumber, payments } = detail;
  const currency = await getBusinessCurrency();

  const db = getDb();
  const [biz] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, invoice.businessId))
    .limit(1);

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const page = doc.addPage([595, 842]); // A4
  const latin = await doc.embedFont(StandardFonts.Helvetica);
  const latinBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const arabic = await doc.embedFont(
    await readFile(path.join(process.cwd(), "assets", "fonts", "NotoSansArabic-Regular.ttf")),
    { subset: true },
  );
  const fontFor = (run: { rtl: boolean }): PDFFont => (run.rtl ? arabic : latin);

  const dark = rgb(0.13, 0.15, 0.18);
  const gray = rgb(0.44, 0.47, 0.52);
  const hairline = rgb(0.78, 0.8, 0.84);
  const money = (n: number | string) => formatMoneyPlain(n, currency);

  const RIGHT = 545;
  const LEFT = 50;

  /** Right-aligned Latin text. */
  const drawRight = (
    text: string,
    x: number,
    y: number,
    size: number,
    font: PDFFont = latin,
    color = dark,
  ) => {
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: x - w, y, size, font, color });
  };

  /** Arabic helper (bidi-correct). y is the baseline. */
  const ar = (
    text: string,
    x: number,
    y: number,
    size: number,
    opts?: { color?: ReturnType<typeof rgb>; align?: "right" | "left" },
  ) =>
    drawArabicText(page, text, {
      font: fontFor,
      size,
      x,
      y,
      color: opts?.color ?? gray,
      align: opts?.align ?? "left",
    });

  /** Bilingual stacked pair: EN at y, AR 11pt below. Returns nothing. */
  const bi = (
    en: string,
    arText: string,
    x: number,
    y: number,
    opts: {
      size?: number;
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
      align?: "left" | "right";
    } = {},
  ) => {
    const size = opts.size ?? 8.5;
    const font = opts.bold ? latinBold : latin;
    const color = opts.color ?? gray;
    if (opts.align === "right") {
      drawRight(en, x, y, size, font, color);
      ar(arText, x, y - 11, 6.5, { color, align: "right" });
    } else {
      page.drawText(en, { x, y, size, font, color });
      ar(arText, x, y - 11, 6.5, { color });
    }
  };

  /* ---------------- Header ---------------- */
  if (biz) {
    try {
      const logo = await getBusinessLogo(biz.id);
      if (logo && logo.mimeType !== "image/svg+xml") {
        const img =
          logo.mimeType === "image/jpeg"
            ? await doc.embedJpg(logo.data)
            : await doc.embedPng(logo.data);
        page.drawImage(img, { x: LEFT, y: 766, width: 52, height: 52 });
      }
    } catch {
      /* logo omitted when unreadable */
    }
  }

  page.drawText(biz?.name ?? "", { x: 114, y: 806, size: 13, font: latinBold, color: dark });
  if (biz?.address) {
    page.drawText(biz.address.slice(0, 60), { x: 114, y: 793, size: 7.5, font: latin, color: gray });
  }
  const contact = [biz?.phone, biz?.email].filter(Boolean).join("   ");
  if (contact) {
    page.drawText(contact, { x: 114, y: 782, size: 7.5, font: latin, color: gray });
  }
  if (biz?.trn) {
    page.drawText(`TRN: ${biz.trn}`, { x: 114, y: 769, size: 8.5, font: latinBold, color: dark });
    ar("الرقم الضريبي", 114, 757, 6.5);
  }

  drawRight("TAX INVOICE", RIGHT, 806, 18, latinBold, dark);
  ar("فاتورة ضريبية", RIGHT, 786, 12, { color: dark, align: "right" });

  drawRight(`Invoice No: ${invoice.invoiceNumber}`, RIGHT, 766, 8.5, latinBold);
  drawRight(`Invoice Date: ${invoice.issueDate}`, RIGHT, 753, 8.5);
  drawRight(`Due Date: ${invoice.dueDate ?? "—"}`, RIGHT, 740, 8.5);
  if (orderNumber) {
    drawRight(`Order No: ${orderNumber}`, RIGHT, 727, 8.5);
    drawRight(`Currency: ${currency}`, RIGHT, 714, 8.5);
  } else {
    drawRight(`Currency: ${currency}`, RIGHT, 727, 8.5);
  }

  /* ---------------- Bill To ---------------- */
  page.drawLine({ start: { x: LEFT, y: 696 }, end: { x: RIGHT, y: 696 }, thickness: 1.4, color: dark });

  bi("Bill To", "بيانات العميل", LEFT, 682, { bold: true, size: 9, color: gray });
  bi("Customer TRN", "الرقم الضريبي للعميل", RIGHT, 682, { bold: true, size: 8.5, color: gray, align: "right" });

  page.drawText(customer.fullName, { x: LEFT, y: 656, size: 11, font: latinBold, color: dark });
  drawRight(customer.trn ?? "—", RIGHT, 654, 9.5, latinBold);
  page.drawText(customer.mobile, { x: LEFT, y: 642, size: 8, font: latin, color: gray });
  if (customer.altMobile) {
    page.drawText(`Alt: ${customer.altMobile}`, { x: LEFT, y: 631, size: 7.5, font: latin, color: gray });
  }
  if (customer.address) {
    page.drawText(customer.address.slice(0, 66), { x: LEFT, y: 620, size: 7.5, font: latin, color: gray });
  }

  /* ---------------- Items table ---------------- */
  const cols = { no: LEFT, desc: LEFT + 22, qty: 356, price: 430, amount: RIGHT };

  // Header: rule 13pt above EN, EN at y, AR 11pt below, rule 16pt below EN.
  page.drawLine({ start: { x: LEFT, y: 596 }, end: { x: RIGHT, y: 596 }, thickness: 0.8, color: dark });
  bi("#", "", cols.no, 583, { bold: true, size: 8, color: gray });
  bi("Description", "البيان", cols.desc, 583, { bold: true, size: 8, color: gray });
  bi("Qty", "الكمية", cols.qty + 18, 583, { bold: true, size: 8, color: gray, align: "right" });
  bi("Unit Price", "سعر الوحدة", cols.price + 40, 583, { bold: true, size: 8, color: gray, align: "right" });
  bi("Amount", "المبلغ", RIGHT, 583, { bold: true, size: 8, color: gray, align: "right" });
  page.drawLine({ start: { x: LEFT, y: 562 }, end: { x: RIGHT, y: 562 }, thickness: 0.8, color: dark });

  const lines =
    (invoice.items as { description: string; quantity: number; unitPrice: number }[]) ?? [];
  let rowY = 548;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    page.drawText(String(i + 1), { x: cols.no, y: rowY, size: 8.5, font: latin, color: gray });
    page.drawText(line.description.slice(0, 46), { x: cols.desc, y: rowY, size: 9, font: latin, color: dark });
    drawRight(String(line.quantity), cols.qty + 18, rowY, 8.5, latin);
    drawRight(money(line.unitPrice), cols.price + 40, rowY, 8.5, latin);
    drawRight(money(line.quantity * line.unitPrice), RIGHT, rowY, 8.5, latin);
    // hairline in the clear gap between rows
    page.drawLine({ start: { x: LEFT, y: rowY - 7 }, end: { x: RIGHT, y: rowY - 7 }, thickness: 0.5, color: hairline });
    rowY -= 20;
  }

  /* ---------------- Totals ---------------- */
  const totalExclVat =
    Number(invoice.subtotal) -
    Number(invoice.discountAmount) +
    Number(invoice.additionalCharges);
  const TCOL = 340;

  // Cursor starts below the table.
  let y = rowY - 4;

  const totalRow = (
    en: string,
    arLabel: string,
    value: string,
    opts: { bold?: boolean; rule?: "top" | "double"; size?: number } = {},
  ) => {
    const size = opts.size ?? 8.5;
    const font = opts.bold ? latinBold : latin;
    if (opts.rule === "top") {
      page.drawLine({
        start: { x: TCOL, y: y + 12 },
        end: { x: RIGHT, y: y + 12 },
        thickness: 1.2,
        color: dark,
      });
    }
    if (opts.rule === "double") {
      page.drawLine({
        start: { x: TCOL, y: y + 18 },
        end: { x: RIGHT, y: y + 18 },
        thickness: 1.4,
        color: dark,
      });
      page.drawLine({
        start: { x: TCOL, y: y + 14.5 },
        end: { x: RIGHT, y: y + 14.5 },
        thickness: 0.7,
        color: dark,
      });
    }
    page.drawText(en, { x: TCOL, y, size, font, color: dark });
    ar(arLabel, TCOL, y - 11, 6.5);
    drawRight(value, RIGHT, y, size, font, dark);
    y -= opts.bold ? 34 : 30;
  };

  totalRow("Subtotal", "الإجمالي الفرعي", money(invoice.subtotal));
  totalRow(
    `Discount ${invoice.discountType === "percent" ? `(${invoice.discountValue}%)` : ""}`.trim(),
    "الخصم",
    `- ${money(invoice.discountAmount)}`,
  );
  if (Number(invoice.additionalCharges) > 0) {
    totalRow(
      invoice.additionalChargesLabel || "Additional charges",
      "رسوم إضافية",
      money(invoice.additionalCharges),
    );
  }
  totalRow("Total (excl. VAT)", "الإجمالي بدون ضريبة", money(totalExclVat), { rule: "top" });
  totalRow(
    `${invoice.taxLabel ?? "VAT"} (${invoice.taxRate}%)`,
    "ضريبة القيمة المضافة",
    money(invoice.taxAmount),
  );
  y -= 10; // extra clearance for the double rule above the grand total
  totalRow("Total (incl. VAT)", "الإجمالي شامل الضريبة", money(invoice.total), {
    bold: true,
    rule: "double",
    size: 10.5,
  });
  totalRow("Amount Paid", "المبلغ المدفوع", money(invoice.amountPaid));
  totalRow("Balance Due", "المبلغ المتبقي", money(invoice.balanceDue), {
    bold: true,
    rule: "top",
    size: 9.5,
  });

  /* ---------------- Payment history ---------------- */
  if (payments.length > 0) {
    y -= 4;
    bi("Payment history", "سجل المدفوعات", LEFT, y, { bold: true, size: 8.5, color: gray });
    y -= 30;
    page.drawLine({ start: { x: LEFT, y: y + 12 }, end: { x: RIGHT, y: y + 12 }, thickness: 0.6, color: hairline });
    for (const p of payments.slice(0, 6)) {
      const when = p.paidAt.toISOString().slice(0, 10);
      page.drawText(when, { x: LEFT, y, size: 7.5, font: latin, color: dark });
      page.drawText(p.method, { x: 140, y, size: 7.5, font: latin, color: dark });
      if (p.reference) {
        page.drawText(p.reference.slice(0, 30), { x: 240, y, size: 7.5, font: latin, color: gray });
      }
      drawRight(money(p.amount), RIGHT, y, 7.5, latin, dark);
      page.drawLine({ start: { x: LEFT, y: y - 6.5 }, end: { x: RIGHT, y: y - 6.5 }, thickness: 0.4, color: hairline });
      y -= 18;
    }
  }

  /* ---------------- Notes ---------------- */
  y -= 12;
  bi("Notes", "ملاحظات", LEFT, y, { bold: true, size: 8.5, color: gray });
  y -= 24;
  const noteText = invoice.notes ?? "Payment is due by the invoice due date.";
  for (const ln of noteText.slice(0, 150).match(/.{1,90}(\s|$)/g) ?? []) {
    if (y < 110) break;
    page.drawText(ln.trim(), { x: LEFT, y, size: 7.5, font: latin, color: gray });
    y -= 11;
  }

  /* ---------------- Footer ---------------- */
  page.drawLine({
    start: { x: LEFT, y: 72 },
    end: { x: RIGHT, y: 72 },
    thickness: 0.5,
    color: hairline,
  });
  page.drawText("This is a computer-generated tax invoice", {
    x: LEFT,
    y: 58,
    size: 7,
    font: latin,
    color: gray,
  });
  ar("فاتورة ضريبية إلكترونية", LEFT, 46, 6.5);
  drawRight("Thank you", RIGHT, 58, 8, latinBold, gray);
  ar("شكراً لكم", RIGHT, 46, 7.5, { align: "right" });

  const bytes = await doc.save();
  const inline = new URL(_req.url).searchParams.get("inline") === "1";
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
}

void (0 as unknown as PDFPage);
