import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-serif text-3xl font-semibold text-balance">Page not found</h1>
        <p className="mt-2 text-muted">Check the address, or go back to your invoices.</p>
        <Link href="/" className="btn-primary mt-8">
          Back to invoices
        </Link>
      </main>
    </>
  );
}
