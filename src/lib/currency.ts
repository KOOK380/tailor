/**
 * Currency formatting driven by the business setting (Module 10 — INR by
 * default, switchable in Settings). Uses Intl so grouping/symbol placement
 * follows the currency's locale conventions.
 */

export interface CurrencyOption {
  code: string;
  symbol: string;
  label: string;
  locale: string;
}

/** Currencies offered in Settings. */
export const CURRENCY_OPTIONS: CurrencyOption[] = [
  { code: "INR", symbol: "₹", label: "Indian Rupee (₹)", locale: "en-IN" },
  { code: "USD", symbol: "$", label: "US Dollar ($)", locale: "en-US" },
  { code: "EUR", symbol: "€", label: "Euro (€)", locale: "de-DE" },
  { code: "GBP", symbol: "£", label: "British Pound (£)", locale: "en-GB" },
  { code: "AED", symbol: "د.إ", label: "UAE Dirham", locale: "en-AE" },
  { code: "SAR", symbol: "﷼", label: "Saudi Riyal", locale: "en-SA" },
  { code: "QAR", symbol: "ر.ق", label: "Qatari Riyal", locale: "en-QA" },
  { code: "KWD", symbol: "د.ك", label: "Kuwaiti Dinar", locale: "en-KW" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar (A$)", locale: "en-AU" },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar (C$)", locale: "en-CA" },
  { code: "SGD", symbol: "S$", label: "Singapore Dollar (S$)", locale: "en-SG" },
  { code: "MYR", symbol: "RM", label: "Malaysian Ringgit", locale: "en-MY" },
  { code: "JPY", symbol: "¥", label: "Japanese Yen (¥)", locale: "ja-JP" },
  { code: "CNY", symbol: "¥", label: "Chinese Yuan (¥)", locale: "zh-CN" },
  { code: "PKR", symbol: "₨", label: "Pakistani Rupee", locale: "en-PK" },
  { code: "BDT", symbol: "৳", label: "Bangladeshi Taka", locale: "en-BD" },
  { code: "LKR", symbol: "Rs", label: "Sri Lankan Rupee", locale: "en-LK" },
  { code: "NPR", symbol: "रू", label: "Nepalese Rupee", locale: "ne-NP" },
  { code: "ZAR", symbol: "R", label: "South African Rand", locale: "en-ZA" },
  { code: "THB", symbol: "฿", label: "Thai Baht", locale: "th-TH" },
];

export const DEFAULT_CURRENCY = "INR";

function localeFor(currency: string): string {
  return (
    CURRENCY_OPTIONS.find((c) => c.code === currency)?.locale ?? "en-US"
  );
}

export function currencySymbol(currency: string = DEFAULT_CURRENCY): string {
  return CURRENCY_OPTIONS.find((c) => c.code === currency)?.symbol ?? currency;
}

/** Format an amount for display, e.g. ₹4,200 / $4,200.00 / 4.200,00 €. */
export function formatMoney(
  amount: number | string,
  currency: string = DEFAULT_CURRENCY,
): string {
  const parsed = typeof amount === "string" ? Number(amount) : amount;
  const value = Number.isFinite(parsed) ? parsed : 0;
  // Only use Intl currency style for codes we know render well; anything
  // else falls back to the explicit ISO-code form (¤ symbol is useless).
  const known = CURRENCY_OPTIONS.some((c) => c.code === currency);
  if (!known) return formatMoneyPlain(value, currency);
  try {
    return new Intl.NumberFormat(localeFor(currency), {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return formatMoneyPlain(value, currency);
  }
}

/**
 * Amount with grouping but no currency symbol — for PDFs rendered with the
 * standard Helvetica font (symbols like ₹ are not in its encoding; the ISO
 * code is used instead).
 */
export function formatMoneyPlain(
  amount: number | string,
  currency: string = DEFAULT_CURRENCY,
): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  const safe = Number.isFinite(value) ? value : 0;
  return `${currency} ${safe.toLocaleString(localeFor(currency), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
