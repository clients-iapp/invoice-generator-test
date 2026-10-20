import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Icon } from "@/components/Icon";
import { InvoiceTable } from "@/components/InvoiceTable";
import { NewInvoiceShortcut } from "@/components/NewInvoiceShortcut";
import { SiteHeader } from "@/components/SiteHeader";
import type { InvoiceSummary } from "@/lib/invoice-types";
import { listInvoices } from "@/lib/invoices";

export default function InvoicesPage() {
  return (
    <>
      <SiteHeader>
        <Link
          href="/invoices/new"
          className="btn-primary"
          title="New invoice (N)"
          aria-keyshortcuts="N"
        >
          <Icon name="plus" />
          New invoice
          <kbd className="ml-1 hidden rounded border border-paper/40 px-1.5 text-xs font-medium md:inline">
            N
          </kbd>
        </Link>
      </SiteHeader>
      <NewInvoiceShortcut />

      <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="font-serif text-3xl font-semibold">Invoices</h1>
        <Suspense fallback={<p className="mt-8 text-sm text-muted">Loading invoices…</p>}>
          <InvoiceList />
        </Suspense>
      </main>
    </>
  );
}

async function InvoiceList() {
  // Read fresh data on every request instead of prerendering at build time.
  await connection();
  let invoices: InvoiceSummary[] | null = null;
  try {
    invoices = await listInvoices();
  } catch (error) {
    console.error(error);
  }

  return invoices === null ? (
    <div role="alert" className="mt-8 rounded-lg border border-danger/30 bg-paper p-6">
      <p className="font-semibold text-danger">Can&apos;t reach the database.</p>
      <p className="mt-1 text-sm text-muted">
        Check that MongoDB is running and that MONGODB_URI in .env.local is correct, then reload.
      </p>
    </div>
  ) : invoices.length === 0 ? (
    <div className="mt-8 rounded-lg border border-dashed border-field bg-paper/60 px-6 py-16 text-center">
      <h2 className="font-serif text-xl font-semibold">No invoices yet</h2>
      <p className="mt-1 text-sm text-muted">
        Create your first invoice. It saves here so you can edit or email it later.
      </p>
      <Link href="/invoices/new" className="btn-primary mt-6">
        <Icon name="plus" />
        Create an invoice
      </Link>
    </div>
  ) : (
    <InvoiceTable invoices={invoices} />
  );
}
