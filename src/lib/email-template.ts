import { lineTotalCents } from "./invoice-math";
import type { InvoiceRecord } from "./invoice-types";
import { formatCents } from "./money";
import { formatDate, formatQuantity, formatTaxRate } from "./format";

/**
 * Renders the invoice email. Uses tables and inline styles because many email
 * clients ignore <style> blocks. Every user-provided value is HTML-escaped.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escapes text and keeps the line breaks a person typed. */
function multiline(value: string): string {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

const INK = "#1d2b36";
const MUTED = "#5b6770";
const RULE = "#d6dcd8";
const ACCENT = "#2b6248";
const DESK = "#eef1ee";

export function renderInvoiceEmail(
  invoice: InvoiceRecord,
  message: string,
  /** File name of the attached PDF, mentioned at the end of the email. */
  attachmentName?: string,
): { html: string; text: string } {
  const { business, customer, totals } = invoice;
  const visibleFields = invoice.customFields.filter((field) => field.visible);
  // Only free text (names, addresses, descriptions, notes) may wrap anywhere; numbers,
  // dates and headings stay on one line so narrow phone screens don't break "$1,000.00".
  const wrap = "overflow-wrap:anywhere;word-break:break-word;";
  const cell = `padding:10px 0;border-bottom:1px solid ${RULE};font-size:14px;`;
  const num =
    "text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap;padding-left:12px;";
  const th = `font-size:12px;color:${MUTED};font-weight:600;padding-bottom:6px;border-bottom:2px solid ${INK};white-space:nowrap;`;
  const shortNumber = invoice.invoiceNumber.length <= 20;

  const lineRows = invoice.lineItems
    .map(
      (line) => `<tr>
        <td style="${cell}${wrap}color:${INK};">${multiline(line.description)}</td>
        <td style="${cell}${num}color:${MUTED};">${formatQuantity(line.quantity)}</td>
        <td style="${cell}${num}color:${MUTED};">${formatCents(line.unitPriceCents)}</td>
        <td style="${cell}${num}color:${INK};">${formatCents(lineTotalCents(line))}</td>
      </tr>`,
    )
    .join("");

  const totalRow = (label: string, value: string) =>
    `<tr><td style="padding:4px 0;font-size:14px;color:${MUTED};white-space:nowrap;">${label}</td>
     <td style="padding:4px 0;font-size:14px;${num}color:${INK};">${value}</td></tr>`;

  const fieldsHtml = visibleFields
    .map(
      (field) =>
        `<tr><td style="padding:2px 16px 2px 0;font-size:13px;color:${MUTED};vertical-align:top;${wrap}">${escapeHtml(field.label)}</td>
         <td style="padding:2px 0;font-size:13px;color:${INK};${wrap}">${multiline(field.value)}</td></tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:${DESK};">
<!-- Many email clients (Gmail, Yopmail) drop <body> styles, so the desk colour and card live on tables. -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${DESK}" style="background:${DESK};font-family:Helvetica,Arial,sans-serif;color:${INK};">
<tr><td style="padding:16px 8px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid ${RULE};border-radius:8px;">
<tr><td style="padding:28px 24px;">
  ${message ? `<p style="margin:0 0 24px;font-size:15px;line-height:1.5;${wrap}">${multiline(message)}</p>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td style="vertical-align:top;${wrap}">
        <div style="font-size:20px;font-weight:700;">${escapeHtml(business.name)}</div>
        <div style="font-size:13px;color:${MUTED};line-height:1.5;margin-top:4px;">
          ${[business.address, business.email, business.phone].filter(Boolean).map(multiline).join("<br>")}
        </div>
      </td>
      <td style="vertical-align:top;text-align:right;padding-left:16px;">
        <div style="font-size:13px;color:${MUTED};">Invoice</div>
        <div style="font-size:18px;font-weight:700;${shortNumber ? "white-space:nowrap;" : wrap}">${escapeHtml(invoice.invoiceNumber)}</div>
      </td>
    </tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
    <tr>
      <td style="vertical-align:top;font-size:13px;line-height:1.5;${wrap}">
        <div style="color:${MUTED};">Billed to</div>
        <div style="font-weight:700;font-size:14px;">${escapeHtml(customer.name)}</div>
        ${[customer.address, customer.email].filter(Boolean).map(multiline).join("<br>")}
      </td>
      <td style="vertical-align:top;text-align:right;font-size:13px;line-height:1.7;white-space:nowrap;padding-left:16px;">
        <span style="color:${MUTED};">Issued</span> ${formatDate(invoice.issueDate)}<br>
        <span style="color:${MUTED};">Due</span> <strong>${formatDate(invoice.dueDate)}</strong>
      </td>
    </tr>
  </table>
  ${fieldsHtml ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px;">${fieldsHtml}</table>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-collapse:collapse;">
    <tr>
      <th align="left" width="100%" style="${th}">Description</th>
      <th align="right" style="${th}padding-left:12px;">Qty</th>
      <th align="right" style="${th}padding-left:12px;">Unit price</th>
      <th align="right" style="${th}padding-left:12px;">Amount</th>
    </tr>
    ${lineRows}
  </table>
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0 0 auto;width:100%;max-width:300px;">
    ${totalRow("Subtotal", formatCents(totals.subtotalCents))}
    ${totals.discountCents > 0 ? totalRow("Discount", `&minus;${formatCents(totals.discountCents)}`) : ""}
    ${totalRow(`Tax (${formatTaxRate(invoice.taxRate)})`, formatCents(totals.taxCents))}
    <tr><td colspan="2" style="padding-top:6px;border-bottom:3px double ${INK};"></td></tr>
    <tr><td style="padding:10px 0 0;font-size:16px;font-weight:700;white-space:nowrap;">Amount due</td>
        <td style="padding:10px 0 0;font-size:18px;font-weight:700;${num}color:${ACCENT};">${formatCents(totals.totalCents)}</td></tr>
  </table>
  ${invoice.notes ? `<div style="margin-top:28px;padding-top:16px;border-top:1px solid ${RULE};font-size:13px;line-height:1.6;color:${MUTED};${wrap}">${multiline(invoice.notes)}</div>` : ""}
  ${attachmentName ? `<p style="margin:24px 0 0;font-size:12px;color:${MUTED};">A PDF copy is attached: ${escapeHtml(attachmentName)}</p>` : ""}
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  const text = [
    message,
    message ? "" : null,
    `${business.name} - Invoice ${invoice.invoiceNumber}`,
    `Billed to: ${customer.name}`,
    `Issued: ${formatDate(invoice.issueDate)}   Due: ${formatDate(invoice.dueDate)}`,
    ...visibleFields.map((field) => `${field.label}: ${field.value}`),
    "",
    ...invoice.lineItems.map(
      (line) =>
        `${line.description} - ${formatQuantity(line.quantity)} x ${formatCents(line.unitPriceCents)} = ${formatCents(lineTotalCents(line))}`,
    ),
    "",
    `Subtotal: ${formatCents(totals.subtotalCents)}`,
    totals.discountCents > 0 ? `Discount: -${formatCents(totals.discountCents)}` : null,
    `Tax (${formatTaxRate(invoice.taxRate)}): ${formatCents(totals.taxCents)}`,
    `Amount due: ${formatCents(totals.totalCents)}`,
    invoice.notes ? `\n${invoice.notes}` : null,
    attachmentName ? `\nA PDF copy is attached: ${attachmentName}` : null,
  ]
    .filter((line) => line !== null)
    .join("\n");

  return { html, text };
}
