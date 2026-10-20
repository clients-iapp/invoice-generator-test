import Link from "next/link";
import type { ReactNode } from "react";

export function Wordmark() {
  return (
    <Link
      href="/"
      translate="no"
      className="rounded-sm font-serif text-xl font-semibold tracking-tight text-ink transition-colors hover:text-ledger"
    >
      Folio
    </Link>
  );
}

export function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="border-b border-rule bg-paper print:hidden">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Wordmark />
        {children}
      </div>
    </header>
  );
}
