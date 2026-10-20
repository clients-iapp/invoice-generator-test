import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache, Suspense } from "react";
import { EditorLoading } from "@/components/EditorLoading";
import { InvoiceEditor } from "@/components/invoice-editor/InvoiceEditor";
import { getInvoice } from "@/lib/invoices";

type Params = PageProps<"/invoices/[id]">["params"];

// cache(): generateMetadata and the page share one database read per request.
const findInvoice = cache(async (id: string) => {
  await connection(); // saved invoices change, so always read them at request time
  return getInvoice(id);
});

async function loadInvoice(params: Params) {
  return findInvoice((await params).id);
}

export async function generateMetadata({ params }: PageProps<"/invoices/[id]">): Promise<Metadata> {
  const invoice = await loadInvoice(params);
  return { title: invoice ? invoice.invoiceNumber : "Invoice not found" };
}

export default function InvoicePage({ params }: PageProps<"/invoices/[id]">) {
  return (
    <Suspense fallback={<EditorLoading />}>
      <SavedInvoiceEditor params={params} />
    </Suspense>
  );
}

async function SavedInvoiceEditor({ params }: { params: Params }) {
  const invoice = await loadInvoice(params);
  if (!invoice) notFound();

  // key: a different invoice gets a fresh editor instead of reusing state.
  return <InvoiceEditor key={invoice.id} initial={invoice} />;
}
