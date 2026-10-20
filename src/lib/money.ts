const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Formats integer cents as US dollars, e.g. 123456 -> "$1,234.56". */
export function formatCents(cents: number): string {
  return usd.format(cents / 100);
}

/** Formats integer cents for an editable input, e.g. 5000 -> "50.00". */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * A typed number: optional minus, optional "$" (money only), digits with either
 * no commas or commas in proper thousands groups, then an optional fraction.
 * "1,234.50" and "$20" match; "12,34" and "1 2" do not, so nothing is guessed.
 */
const NUMBER = /^(-)?(\$)?(\d{1,3}(?:,\d{3})+|\d*)(?:\.(\d*))?$/;

function matchNumber(input: string, allowDollar: boolean) {
  const match = NUMBER.exec(input.trim());
  if (!match) return null;
  const [, sign = "", dollar, whole, rawFraction = ""] = match;
  if ((dollar && !allowDollar) || (whole === "" && rawFraction === "")) return null;
  // "8.8750" is the same number as "8.875".
  const fraction = rawFraction.replace(/0+$/, "");
  return { negative: sign === "-", whole: whole.replace(/,/g, "") || "0", fraction };
}

/**
 * Parses what a person typed, e.g. "1,000" or "8.875". Returns NaN for anything that
 * isn't a plain number so validation can explain the problem instead of guessing.
 * Precision is not capped here; the schema reports "at most N decimal places".
 */
export function parseDecimal(input: string): number {
  const parts = matchNumber(input, false);
  if (!parts) return NaN;
  const value = Number(`${parts.whole}.${parts.fraction || "0"}`);
  return parts.negative ? -value : value;
}

/**
 * Parses a typed dollar amount ("$1,234.5") into integer cents using string
 * arithmetic, so binary floating point never touches money ("0.29" -> 29).
 * More than 2 decimals gives a non-integer, which the schema reports clearly.
 */
export function parseDollarsToCents(input: string): number {
  const parts = matchNumber(input, true);
  if (!parts) return NaN;
  const cents =
    Number(parts.whole) * 100 +
    Number(parts.fraction.slice(0, 2).padEnd(2, "0")) +
    Number(`0.${parts.fraction.slice(2) || "0"}`);
  return parts.negative ? -cents : cents;
}

/** Treats anything that isn't a positive finite number as 0 (used for mid-edit previews). */
export function positiveOrZero(n: number): number {
  return Number.isFinite(n) && n > 0 ? n : 0;
}
