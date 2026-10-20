"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import { Icon } from "@/components/Icon";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/format";
import type { InvoiceSummary } from "@/lib/invoice-types";
import { formatCents } from "@/lib/money";

type Notice = { tone: "success" | "error"; text: string } | null;

/** The saved-invoices table, with a delete action on each row. */
export function InvoiceTable({ invoices }: { invoices: InvoiceSummary[] }) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  async function remove(invoice: InvoiceSummary) {
    const confirmed = await confirm({
      title: `Delete ${invoice.invoiceNumber}?`,
      message: `This permanently removes the invoice for ${invoice.customerName}. It can't be undone.`,
      confirmLabel: "Delete invoice",
      tone: "danger",
    });
    if (!confirmed) return;

    setDeletingId(invoice.id);
    const response = await fetch(`/api/invoices/${invoice.id}`, { method: "DELETE" }).catch(
      () => null,
    );
    setDeletingId(null);
    if (!response || (!response.ok && response.status !== 404)) {
      setNotice({ tone: "error", text: `Couldn't delete ${invoice.invoiceNumber}. Try again.` });
      return;
    }
    // Hide the row straight away, then let the server re-render the list.
    setRemovedIds((previous) => new Set(previous).add(invoice.id));
    setNotice({ tone: "success", text: `Deleted ${invoice.invoiceNumber}` });
    router.refresh();
  }

  const visible = invoices.filter((invoice) => !removedIds.has(invoice.id));

  return (
    <>
      <p
        role="status"
        aria-live="polite"
        className={`mt-6 text-sm ${notice?.tone === "error" ? "text-danger" : "text-muted"} ${notice ? "" : "sr-only"}`}
      >
        {notice?.text}
      </p>

      <div className="mt-4 overflow-hidden rounded-lg border border-rule bg-paper">
        <table className="w-full text-sm">
          <caption className="sr-only">Saved invoices, most recently updated first</caption>
          <thead className="hidden border-b-2 border-ink text-left text-muted md:table-header-group">
            <tr>
              <th scope="col" className="px-5 py-3 font-semibold">
                Invoice
              </th>
              <th scope="col" className="px-5 py-3 font-semibold">
                Customer
              </th>
              <th scope="col" className="px-5 py-3 font-semibold">
                Issued
              </th>
              <th scope="col" className="px-5 py-3 font-semibold">
                Due
              </th>
              <th scope="col" className="px-5 py-3 font-semibold">
                Status
              </th>
              <th scope="col" className="px-5 py-3 text-right font-semibold">
                Amount
              </th>
              <th scope="col" className="w-px py-3 pr-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((invoice) => (
              <tr
                key={invoice.id}
                className="relative grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-b border-rule px-5 py-4 last:border-b-0 hover:bg-desk/50 md:table-row md:p-0"
              >
                <td className="md:px-5 md:py-4">
                  {/* The stretched link makes the whole row clickable while keeping one tab stop per invoice. */}
                  <Link
                    href={`/invoices/${invoice.id}`}
                    className="tabular font-semibold text-ink underline-offset-4 after:absolute after:inset-0 hover:underline"
                  >
                    {invoice.invoiceNumber}
                  </Link>
                </td>
                <td className="col-start-1 min-w-0 md:px-5 md:py-4">
                  <span className="block truncate md:max-w-64">{invoice.customerName}</span>
                </td>
                <td className="tabular hidden text-muted md:table-cell md:px-5 md:py-4">
                  {formatDate(invoice.issueDate)}
                </td>
                <td className="tabular col-start-1 text-muted md:px-5 md:py-4">
                  <span className="md:hidden">Due </span>
                  {formatDate(invoice.dueDate)}
                </td>
                <td className="col-start-2 row-start-1 justify-self-end md:px-5 md:py-4">
                  <StatusBadge status={invoice.status} />
                </td>
                <td className="tabular col-start-2 row-start-2 text-right font-semibold md:px-5 md:py-4">
                  {formatCents(invoice.totalCents)}
                </td>
                <td className="col-start-2 row-start-3 justify-self-end md:py-2 md:pr-3">
                  {/* relative z-10 lifts the button above the row's stretched link. */}
                  <button
                    type="button"
                    className="btn-quiet relative z-10 -mr-2 hover:bg-danger-tint hover:text-danger md:mr-0"
                    aria-label={`Delete ${invoice.invoiceNumber}`}
                    title="Delete invoice"
                    disabled={deletingId === invoice.id}
                    onClick={() => remove(invoice)}
                  >
                    <Icon name="trash" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dialog}
    </>
  );
}
