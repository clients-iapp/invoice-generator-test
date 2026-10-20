const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-10-01" -> "Oct 1, 2026". Read as UTC so the day never shifts by time zone. */
export function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? "" : dateFormat.format(date);
}

export function formatQuantity(quantity: number): string {
  return quantity.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function formatTaxRate(rate: number): string {
  return `${rate.toLocaleString("en-US", { maximumFractionDigits: 3 })}%`;
}

/** Today's date as YYYY-MM-DD in the server's local time zone. */
export function todayIso(now = new Date()): string {
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
