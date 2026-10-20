import { duplicateNumberError, notFound, parseJsonBody, serverError } from "@/lib/api";
import { invoiceInputSchema } from "@/lib/invoice-schema";
import { deleteInvoice, getInvoice, isDuplicateKeyError, updateInvoice } from "@/lib/invoices";

export async function GET(_request: Request, ctx: RouteContext<"/api/invoices/[id]">) {
  const { id } = await ctx.params;
  try {
    const invoice = await getInvoice(id);
    return invoice ? Response.json({ invoice }) : notFound();
  } catch (error) {
    return serverError(error);
  }
}

export async function PUT(request: Request, ctx: RouteContext<"/api/invoices/[id]">) {
  const { id } = await ctx.params;
  const parsed = await parseJsonBody(request, invoiceInputSchema);
  if ("response" in parsed) return parsed.response;

  try {
    const invoice = await updateInvoice(id, parsed.data);
    return invoice ? Response.json({ invoice }) : notFound();
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return duplicateNumberError(parsed.data.invoiceNumber);
    }
    return serverError(error);
  }
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/invoices/[id]">) {
  const { id } = await ctx.params;
  try {
    return (await deleteInvoice(id)) ? new Response(null, { status: 204 }) : notFound();
  } catch (error) {
    return serverError(error);
  }
}
