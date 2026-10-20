"use client";

import Link from "next/link";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="font-serif text-3xl font-semibold text-balance">This page didn&apos;t load</h1>
      <p className="mt-2 text-muted">
        The server couldn&apos;t load the data. If you&apos;re running locally, check that MongoDB
        is running and MONGODB_URI in .env.local is correct.
      </p>
      <div className="mt-8 flex justify-center gap-2">
        <button type="button" className="btn-primary" onClick={reset}>
          Try again
        </button>
        <Link href="/" className="btn-secondary">
          Back to invoices
        </Link>
      </div>
    </main>
  );
}
