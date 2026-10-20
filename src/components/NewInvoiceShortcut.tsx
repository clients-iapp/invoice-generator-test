"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Press N on the invoice list to start a new invoice (ignored while typing). */
export function NewInvoiceShortcut() {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "n" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true'], dialog[open]"))
        return;
      event.preventDefault();
      router.push("/invoices/new");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return null;
}
