import { describe, it, expect } from "vitest";
import {
  formatMoney,
  formatMoneyPlain,
  currencySymbol,
  DEFAULT_CURRENCY,
} from "./currency";

describe("formatMoney", () => {
  it("formats INR with rupee symbol and Indian grouping", () => {
    expect(formatMoney(4200, "INR")).toBe("₹4,200.00");
    expect(formatMoney(123456.5, "INR")).toContain("1,23,456.50");
    expect(formatMoney("4956", "INR")).toBe("₹4,956.00");
  });

  it("formats USD / EUR / GBP with their symbols", () => {
    expect(formatMoney(4200, "USD")).toBe("$4,200.00");
    expect(formatMoney(4200, "GBP")).toBe("£4,200.00");
    expect(formatMoney(4200, "EUR")).toContain("4.200,00");
  });

  it("falls back to the ISO code for unknown currencies", () => {
    expect(formatMoney(10, "XXX")).toBe("XXX 10.00");
  });

  it("handles NaN gracefully", () => {
    expect(formatMoney("oops", "INR")).toBe("₹0.00");
  });

  it("defaults to INR", () => {
    expect(DEFAULT_CURRENCY).toBe("INR");
    expect(formatMoney(100)).toBe("₹100.00");
  });
});

describe("formatMoneyPlain (PDF-safe)", () => {
  it("uses the ISO code instead of symbols", () => {
    expect(formatMoneyPlain(4200, "INR")).toBe("INR 4,200.00");
    expect(formatMoneyPlain(4200, "USD")).toBe("USD 4,200.00");
  });
});

describe("currencySymbol", () => {
  it("maps codes to symbols", () => {
    expect(currencySymbol("INR")).toBe("₹");
    expect(currencySymbol("USD")).toBe("$");
    expect(currencySymbol("EUR")).toBe("€");
    expect(currencySymbol("UNKNOWN")).toBe("UNKNOWN");
  });
});
