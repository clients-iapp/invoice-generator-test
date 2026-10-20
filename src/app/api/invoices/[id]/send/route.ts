import { jsonError, notFound, parseJsonBody, serverError } from "@/lib/api";
import { renderInvoiceEmail } from "@/lib/email-template";
import { invoicePdfFileName, renderInvoicePdf } from "@/lib/invoice-pdf";
import { sendInvoiceSchema } from "@/lib/invoice-schema";
import { getInvoice, markInvoiceSent } from "@/lib/invoices";
import { MailerNotConfiguredError, sendEmail } from "@/lib/mailer";
import { rateLimit } from "@/lib/rate-limit";

// Keyed per invoice plus one global bucket, not by client IP: X-Forwarded-For is
// set by the client unless a trusted proxy overwrites it, so it can't be trusted here.
const LIMITS = [
  { key: (id: string) => `send:${id}`, max: 5 },
  { key: () => "send:all", max: 20 },
];

function tooManyEmails(retryAfterSeconds: number): Response {
  return jsonError(
    429,
    `Too many emails in a short time. Try again in ${retryAfterSeconds} seconds.`,
    undefined,
    { "Retry-After": String(retryAfterSeconds) },
  );
}

export async function POST(request: Request, ctx: RouteContext<"/api/invoices/[id]/send">) {
  const { id } = await ctx.params;
  const parsed = await parseJsonBody(request, sendInvoiceSchema);
  if ("response" in parsed) return parsed.response;

  let invoice;
  try {
    // Always email the saved invoice, never whatever the browser sends.
    invoice = await getInvoice(id);
  } catch (error) {
    return serverError(error);
  }
  if (!invoice) return notFound();

  for (const limit of LIMITS) {
    const result = rateLimit(limit.key(invoice.id), limit.max, 60_000);
    if (!result.ok) return tooManyEmails(result.retryAfterSeconds);
  }

  const { to, message } = parsed.data;
  const subject =
    parsed.data.subject || `Invoice ${invoice.invoiceNumber} from ${invoice.business.name}`;

  // The PDF is a convenience copy: the full invoice is also in the email body, so if
  // rendering fails the email still goes out and the user is told.
  let attachment: { filename: string; content: Buffer; contentType: string } | undefined;
  try {
    attachment = {
      filename: invoicePdfFileName(invoice),
      content: await renderInvoicePdf(invoice),
      contentType: "application/pdf",
    };
  } catch (error) {
    console.error(error);
  }
  const pdfWarning = attachment
    ? undefined
    : "The email was sent, but without the PDF attachment (it couldn't be generated).";

  const { html, text } = renderInvoiceEmail(invoice, message, attachment?.filename);

  try {
    await sendEmail({
      to,
      subject,
      html,
      text,
      replyTo: invoice.business.email || undefined,
      attachments: attachment ? [attachment] : undefined,
    });
  } catch (error) {
    if (error instanceof MailerNotConfiguredError) {
      console.error(error.message);
      return jsonError(
        503,
        "Email isn't set up on the server yet. Add the SMTP settings to .env.local.",
      );
    }
    console.error(error);
    return jsonError(
      502,
      "The email server didn't accept the message. Check the SMTP settings and try again.",
    );
  }

  // The email has gone out. If recording that fails, say so instead of returning
  // an error, otherwise a retry would send the customer a second copy.
  try {
    const updated = await markInvoiceSent(id, to);
    if (!updated) return notFound(); // deleted while the email was being sent
    return Response.json({ invoice: updated, ...(pdfWarning && { warning: pdfWarning }) });
  } catch (error) {
    console.error(error);
    return Response.json({
      invoice,
      warning: "The email was sent, but the invoice couldn't be marked as sent.",
    });
  }
}
