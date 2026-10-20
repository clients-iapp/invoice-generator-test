import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { EditorLoading } from "@/components/EditorLoading";
import { InvoiceEditor } from "@/components/invoice-editor/InvoiceEditor";
import { addDays, todayIso } from "@/lib/format";
import type { InvoiceInput } from "@/lib/invoice-schema";
import { latestBusinessDetails, suggestInvoiceNumber } from "@/lib/invoices";

export const metadata: Metadata = { title: "New invoice" };

const PAYMENT_TERMS_DAYS = 30;

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<EditorLoading />}>
      <NewInvoiceEditor />
    </Suspense>
  );
}

async function NewInvoiceEditor() {
  await connection(); // today's date and the next number are per request
  const [invoiceNumber, business] = await Promise.all([
    suggestInvoiceNumber(),
    latestBusinessDetails(),
  ]);
  const issueDate = todayIso();

  const initial: InvoiceInput = {
    invoiceNumber,
    issueDate,
    dueDate: addDays(issueDate, PAYMENT_TERMS_DAYS),
    // Most people bill from the same business every time, so carry it over.
    business: business ?? { name: "", email: "", phone: "", address: "" },
    customer: { name: "", email: "", address: "" },
    lineItems: [{ description: "", quantity: 1, unitPriceCents: 0 }],
    discountCents: 0,
    taxRate: 0,
    customFields: [],
    notes: "",
  };

  // A new key per request gives every visit a fresh editor. Without it, Next can reuse a
  // kept-alive editor, bringing back an abandoned draft or a just-saved invoice.
  return (
    <InvoiceEditor
      key={crypto.randomUUID()}
      initial={initial}
      defaultTermsDays={PAYMENT_TERMS_DAYS}
    />
  );
}
