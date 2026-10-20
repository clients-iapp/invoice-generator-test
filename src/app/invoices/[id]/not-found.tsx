import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export default function InvoiceNotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-serif text-3xl font-semibold text-balance">Invoice not found</h1>
        <p className="mt-2 text-muted">The link may be wrong, or the invoice was deleted.</p>
        <Link href="/" className="btn-primary mt-8">
          Back to invoices
        </Link>
      </main>
    </>
  );
}
