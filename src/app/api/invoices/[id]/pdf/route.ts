import { notFound, serverError } from "@/lib/api";
import { invoicePdfFileName, renderInvoicePdf } from "@/lib/invoice-pdf";
import { getInvoice } from "@/lib/invoices";

/** The saved invoice as a PDF (the same file that is attached to invoice emails). */
export async function GET(_request: Request, ctx: RouteContext<"/api/invoices/[id]/pdf">) {
  const { id } = await ctx.params;
  try {
    const invoice = await getInvoice(id);
    if (!invoice) return notFound();

    const pdf = await renderInvoicePdf(invoice);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${invoicePdfFileName(invoice)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return serverError(error);
  }
}
