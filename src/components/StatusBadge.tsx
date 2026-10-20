import type { InvoiceStatus } from "@/lib/invoice-types";

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return status === "sent" ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-ledger-tint px-2.5 py-0.5 text-xs font-semibold text-ledger-dark">
      <span className="size-1.5 rounded-full bg-ledger" aria-hidden="true" />
      Sent
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-paper px-2.5 py-0.5 text-xs font-semibold text-muted">
      <span className="size-1.5 rounded-full border border-muted" aria-hidden="true" />
      Draft
    </span>
  );
}
