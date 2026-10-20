/**
 * Invoice arithmetic, shared by the live preview (browser) and the API (server)
 * so both always agree. All money is integer cents.
 *
 * Order required by the brief:
 *   1. round each line (quantity x unit price) to cents
 *   2. sum the lines into the subtotal
 *   3. subtract the fixed discount
 *   4. calculate tax on what is left and round it to cents
 *
 * Example: 2 x $50.00 - $10.00 discount + 10% tax = $99.00
 */

export interface LineAmountInput {
  /** Up to 2 decimal places, e.g. 1.5 hours. */
  quantity: number;
  unitPriceCents: number;
}

export interface TotalsInput {
  lineItems: LineAmountInput[];
  discountCents: number;
  /** Percentage with up to 3 decimal places, e.g. 8.875 for 8.875%. */
  taxRate: number;
}

export interface Totals {
  lineTotalsCents: number[];
  subtotalCents: number;
  discountCents: number;
  taxableCents: number;
  taxCents: number;
  totalCents: number;
}

/**
 * Computes round_half_up(a * b / divisor) exactly. BigInt avoids both float
 * error and overflow on large invoices. Inputs must be non-negative integers.
 */
function mulDivRoundHalfUp(a: number, b: number, divisor: number): number {
  const d = BigInt(divisor);
  return Number((BigInt(a) * BigInt(b) + d / BigInt(2)) / d);
}

export function lineTotalCents({ quantity, unitPriceCents }: LineAmountInput): number {
  // Quantity has at most 2 decimals, so quantity x 100 is a whole number.
  return mulDivRoundHalfUp(Math.round(quantity * 100), unitPriceCents, 100);
}

/** Expects validated, non-negative input (see invoice-schema.ts). */
export function calculateTotals({ lineItems, discountCents, taxRate }: TotalsInput): Totals {
  const lineTotalsCents = lineItems.map(lineTotalCents);
  const subtotalCents = lineTotalsCents.reduce((sum, cents) => sum + cents, 0);
  const taxableCents = subtotalCents - discountCents;
  // taxRate is a percentage with up to 3 decimals: 10% -> 10000 / 100000.
  const taxCents = mulDivRoundHalfUp(taxableCents, Math.round(taxRate * 1000), 100_000);

  return {
    lineTotalsCents,
    subtotalCents,
    discountCents,
    taxableCents,
    taxCents,
    totalCents: taxableCents + taxCents,
  };
}
