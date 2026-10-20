import { connection } from "next/server";
import { duplicateNumberError, parseJsonBody, serverError } from "@/lib/api";
import { invoiceInputSchema } from "@/lib/invoice-schema";
import { createInvoice, isDuplicateKeyError, listInvoices } from "@/lib/invoices";

export async function GET() {
  await connection(); // always query at request time, never at build time
  try {
    return Response.json({ invoices: await listInvoices() });
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, invoiceInputSchema);
  if ("response" in parsed) return parsed.response;

  try {
    const invoice = await createInvoice(parsed.data);
    return Response.json({ invoice }, { status: 201 });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return duplicateNumberError(parsed.data.invoiceNumber);
    }
    return serverError(error);
  }
}
