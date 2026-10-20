import { Fragment, type ReactNode } from "react";
import type { Totals } from "@/lib/invoice-math";
import type { InvoiceInput } from "@/lib/invoice-schema";
import { formatDate, formatQuantity, formatTaxRate } from "@/lib/format";
import { formatCents, positiveOrZero } from "@/lib/money";

/** Shown on screen for empty fields; left off the printed page. */
function Placeholder({ children }: { children: ReactNode }) {
  return <span className="text-muted italic print:hidden">{children}</span>;
}

function TotalRow({ label, value }: { label: ReactNode; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-6 py-1">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular ml-auto">{value}</dd>
    </div>
  );
}

/**
 * The invoice as a sheet of paper. Used for the live preview and for printing,
 * so what people see is exactly what they print. Hidden custom fields never render.
 */
export function InvoicePreview({ invoice, totals }: { invoice: InvoiceInput; totals: Totals }) {
  const { business, customer } = invoice;
  const visibleFields = invoice.customFields.filter(
    (field) => field.visible && (field.label.trim() !== "" || field.value.trim() !== ""),
  );
  const businessContact = [business.address, business.email, business.phone].filter((part) =>
    part.trim(),
  );
  const customerContact = [customer.address, customer.email].filter((part) => part.trim());

  return (
    <article
      aria-label="Invoice preview"
      className="invoice-sheet @container mx-auto w-full max-w-[816px] bg-paper p-6 text-ink shadow-[0_1px_2px_rgb(29_43_54/0.08),0_18px_40px_-16px_rgb(29_43_54/0.3)] sm:p-10 xl:p-14"
    >
      <header className="flex flex-col gap-6 @lg:flex-row @lg:items-start @lg:justify-between">
        <div className="min-w-0">
          <p className="font-serif text-2xl/tight font-semibold wrap-anywhere">
            {business.name.trim() || <Placeholder>Your business name</Placeholder>}
          </p>
          {businessContact.length > 0 && (
            <p className="mt-2 text-sm/relaxed whitespace-pre-line wrap-anywhere text-muted">
              {businessContact.join("\n")}
            </p>
          )}
        </div>
        <div className="shrink-0 @lg:text-right">
          <p className="text-sm text-muted">Invoice</p>
          <p className="tabular font-serif text-xl font-semibold wrap-anywhere">
            {invoice.invoiceNumber.trim() || <Placeholder>No number</Placeholder>}
          </p>
        </div>
      </header>

      <div className="mt-10 grid gap-6 @lg:grid-cols-[minmax(0,1fr)_auto] @lg:gap-12">
        <div className="min-w-0">
          <p className="text-sm text-muted">Billed to</p>
          <p className="mt-1 font-semibold wrap-anywhere">
            {customer.name.trim() || <Placeholder>Customer name</Placeholder>}
          </p>
          {customerContact.length > 0 && (
            <p className="mt-1 text-sm/relaxed whitespace-pre-line wrap-anywhere text-muted">
              {customerContact.join("\n")}
            </p>
          )}
        </div>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] content-start gap-x-6 gap-y-1.5 text-sm">
          <dt className="text-muted">Issued</dt>
          <dd className="tabular whitespace-nowrap">
            {formatDate(invoice.issueDate) || <Placeholder>Not set</Placeholder>}
          </dd>
          <dt className="text-muted">Due</dt>
          <dd className="tabular font-semibold whitespace-nowrap">
            {formatDate(invoice.dueDate) || <Placeholder>Not set</Placeholder>}
          </dd>
          {visibleFields.map((field, index) => (
            <Fragment key={index}>
              <dt className="max-w-40 wrap-anywhere text-muted">{field.label}</dt>
              <dd className="wrap-anywhere whitespace-pre-line">{field.value}</dd>
            </Fragment>
          ))}
        </dl>
      </div>

      <table className="mt-10 w-full border-collapse text-sm">
        <caption className="sr-only">Line items</caption>
        <thead>
          <tr className="border-b-2 border-ink text-muted">
            <th scope="col" className="w-full pb-2 text-left font-semibold">
              Description
            </th>
            <th
              scope="col"
              className="hidden pb-2 pl-4 text-right font-semibold whitespace-nowrap @lg:table-cell"
            >
              Qty
            </th>
            <th
              scope="col"
              className="hidden pb-2 pl-4 text-right font-semibold whitespace-nowrap @lg:table-cell"
            >
              Unit price
            </th>
            <th scope="col" className="pb-2 pl-4 text-right font-semibold whitespace-nowrap">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {invoice.lineItems.map((line, index) => (
            <tr key={index} className="border-b border-rule align-top">
              <td className="py-3">
                <span className="wrap-anywhere whitespace-pre-line">
                  {line.description.trim() || <Placeholder>Untitled item</Placeholder>}
                </span>
                {/* Narrow sheets fold quantity and price under the description. */}
                <span className="tabular mt-0.5 block text-muted @lg:hidden">
                  {formatQuantity(positiveOrZero(line.quantity))} ×{" "}
                  {formatCents(positiveOrZero(line.unitPriceCents))}
                </span>
              </td>
              <td className="tabular hidden py-3 pl-4 text-right whitespace-nowrap text-muted @lg:table-cell">
                {formatQuantity(positiveOrZero(line.quantity))}
              </td>
              <td className="tabular hidden py-3 pl-4 text-right whitespace-nowrap text-muted @lg:table-cell">
                {formatCents(positiveOrZero(line.unitPriceCents))}
              </td>
              <td className="tabular py-3 pl-4 text-right whitespace-nowrap">
                {formatCents(totals.lineTotalsCents[index] ?? 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="invoice-totals mt-5 ml-auto w-full max-w-80 text-sm">
        <TotalRow label="Subtotal" value={formatCents(totals.subtotalCents)} />
        {totals.discountCents > 0 && (
          <TotalRow label="Discount" value={`−${formatCents(totals.discountCents)}`} />
        )}
        <TotalRow
          label={`Tax (${formatTaxRate(positiveOrZero(invoice.taxRate))})`}
          value={formatCents(totals.taxCents)}
        />
        {/* The accountant's double rule marks the final figure. */}
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-6 border-t-[3px] border-double border-ink pt-3">
          <dt className="font-semibold">Amount due</dt>
          <dd className="tabular ml-auto font-serif text-2xl font-semibold text-ledger">
            {formatCents(totals.totalCents)}
          </dd>
        </div>
      </dl>

      {invoice.notes.trim() && (
        <section className="mt-12 border-t border-rule pt-4 text-sm">
          <h2 className="text-muted">Notes</h2>
          <p className="mt-1 leading-relaxed wrap-anywhere whitespace-pre-line">{invoice.notes}</p>
        </section>
      )}
    </article>
  );
}
