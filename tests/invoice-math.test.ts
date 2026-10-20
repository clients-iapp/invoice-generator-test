import { describe, expect, it } from "vitest";
import { calculateTotals, lineTotalCents } from "@/lib/invoice-math";

describe("calculateTotals", () => {
  it("matches the brief: 2 x $50 - $10 discount + 10% tax = $99.00", () => {
    const totals = calculateTotals({
      lineItems: [{ quantity: 2, unitPriceCents: 5000 }],
      discountCents: 1000,
      taxRate: 10,
    });

    expect(totals).toEqual({
      lineTotalsCents: [10000],
      subtotalCents: 10000,
      discountCents: 1000,
      taxableCents: 9000,
      taxCents: 900,
      totalCents: 9900,
    });
  });

  it("rounds each line to cents before summing", () => {
    // 1.5 x $0.33 = $0.495 -> $0.50 per line; summing unrounded would give $0.99.
    const totals = calculateTotals({
      lineItems: [
        { quantity: 1.5, unitPriceCents: 33 },
        { quantity: 1.5, unitPriceCents: 33 },
      ],
      discountCents: 0,
      taxRate: 0,
    });

    expect(totals.lineTotalsCents).toEqual([50, 50]);
    expect(totals.subtotalCents).toBe(100);
  });

  it("applies the discount before tax and rounds tax half up", () => {
    // ($10.05 - $0.00) x 8.875% = $0.8919375 -> $0.89
    expect(
      calculateTotals({
        lineItems: [{ quantity: 1, unitPriceCents: 1005 }],
        discountCents: 0,
        taxRate: 8.875,
      }).taxCents,
    ).toBe(89);
    // $0.10 x 5% = $0.005 -> rounds half up to $0.01
    expect(
      calculateTotals({
        lineItems: [{ quantity: 1, unitPriceCents: 10 }],
        discountCents: 0,
        taxRate: 5,
      }).taxCents,
    ).toBe(1);
  });

  it("allows a discount equal to the subtotal", () => {
    const totals = calculateTotals({
      lineItems: [{ quantity: 1, unitPriceCents: 2500 }],
      discountCents: 2500,
      taxRate: 20,
    });
    expect(totals.taxCents).toBe(0);
    expect(totals.totalCents).toBe(0);
  });

  it("stays exact on large invoices", () => {
    const totals = calculateTotals({
      lineItems: Array.from({ length: 100 }, () => ({
        quantity: 100_000,
        unitPriceCents: 100_000_000,
      })),
      discountCents: 0,
      taxRate: 100,
    });
    expect(totals.subtotalCents).toBe(1_000_000_000_000_000);
    expect(totals.totalCents).toBe(2_000_000_000_000_000);
  });
});

describe("lineTotalCents", () => {
  it("avoids floating point error on decimal quantities", () => {
    // 0.1 + 0.2 style trap: 1.15 x 100 is 114.99999999999999 in floats.
    expect(lineTotalCents({ quantity: 1.15, unitPriceCents: 100 })).toBe(115);
    expect(lineTotalCents({ quantity: 3, unitPriceCents: 1999 })).toBe(5997);
  });
});
