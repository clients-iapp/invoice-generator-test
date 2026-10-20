import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatDate, formatQuantity, formatTaxRate } from "./format";
import { lineTotalCents } from "./invoice-math";
import type { InvoiceRecord } from "./invoice-types";
import { formatCents } from "./money";

/**
 * The invoice as a PDF, attached to invoice emails and served by
 * GET /api/invoices/:id/pdf. Rendered in Node with react-pdf, so no headless
 * browser is needed. Uses the PDF built-in Helvetica and Times (the same
 * families as the email), which cover Latin text.
 */

const INK = "#1d2b36";
const MUTED = "#5b6770";
const RULE = "#d6dcd8";
const ACCENT = "#2b6248";

// Ordinary words are never hyphenated; only very long unbroken tokens (a pasted reference)
// are split into 12-character pieces so they can't run off the page. react-pdf always adds
// a "-" at such a break, so splitting at a token's own "-" would print "--".
Font.registerHyphenationCallback((word) =>
  word.length > 24 ? (word.match(/.{1,12}/g) ?? [word]) : [word],
);

const styles = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 56,
    paddingHorizontal: 44,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: INK,
    lineHeight: 1.4,
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  muted: { color: MUTED },
  businessName: { fontFamily: "Times-Bold", fontSize: 20, lineHeight: 1.15 },
  invoiceNumber: { fontFamily: "Times-Bold", fontSize: 14, textAlign: "right" },
  block: { marginTop: 28 },
  label: { color: MUTED, fontSize: 9 },
  customerName: { fontFamily: "Helvetica-Bold", fontSize: 11, marginTop: 2 },
  metaRow: { flexDirection: "row", marginBottom: 2 },
  metaLabel: { color: MUTED, width: 84, paddingRight: 10 },
  metaValue: { maxWidth: 150 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1.5,
    borderBottomColor: INK,
    paddingBottom: 5,
    marginTop: 28,
    color: MUTED,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
    paddingVertical: 7,
  },
  colDescription: { flex: 1, paddingRight: 10 },
  colQty: { width: 45, textAlign: "right" },
  colPrice: { width: 75, textAlign: "right" },
  colAmount: { width: 80, textAlign: "right" },
  totals: { marginTop: 14, marginLeft: "auto", width: 230 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  doubleRule: {
    marginTop: 5,
    height: 3.5,
    borderTopWidth: 0.75,
    borderBottomWidth: 0.75,
    borderColor: INK,
  },
  // react-pdf can't align baselines, so the label is nudged down to sit on the figure's baseline.
  amountDue: { alignItems: "flex-start", marginTop: 8 },
  amountDueValue: { fontFamily: "Times-Bold", fontSize: 17, color: ACCENT },
  notes: { marginTop: 32, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: RULE },
  footer: {
    position: "absolute",
    bottom: 26,
    left: 44,
    right: 44,
    fontSize: 8,
    color: MUTED,
    maxLines: 1,
    textOverflow: "ellipsis",
  },
});

/** Text in a PDF built-in font can only show plain line breaks; keep the ones people typed. */
const lines = (...parts: string[]) => parts.filter((part) => part.trim()).join("\n");

function InvoiceDocument({ invoice }: { invoice: InvoiceRecord }) {
  const { business, customer, totals } = invoice;
  const visibleFields = invoice.customFields.filter((field) => field.visible);

  return (
    <Document
      title={`Invoice ${invoice.invoiceNumber}`}
      author={business.name}
      subject={`Invoice for ${customer.name}`}
      creator="Folio"
      producer="Folio"
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.row}>
          <View style={{ flex: 1, paddingRight: 24 }}>
            <Text style={styles.businessName}>{business.name}</Text>
            <Text style={[styles.muted, { marginTop: 4 }]}>
              {lines(business.address, business.email, business.phone)}
            </Text>
          </View>
          <View style={{ maxWidth: 200, alignItems: "flex-end" }}>
            <Text style={styles.label}>Invoice</Text>
            <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
          </View>
        </View>

        <View style={[styles.row, styles.block]}>
          <View style={{ flex: 1, paddingRight: 24 }}>
            <Text style={styles.label}>Billed to</Text>
            <Text style={styles.customerName}>{customer.name}</Text>
            <Text style={styles.muted}>{lines(customer.address, customer.email)}</Text>
          </View>
          <View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Issued</Text>
              <Text style={styles.metaValue}>{formatDate(invoice.issueDate)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Due</Text>
              <Text style={[styles.metaValue, { fontFamily: "Helvetica-Bold" }]}>
                {formatDate(invoice.dueDate)}
              </Text>
            </View>
            {visibleFields.map((field, index) => (
              <View key={index} style={styles.metaRow}>
                <Text style={styles.metaLabel}>{field.label}</Text>
                <Text style={styles.metaValue}>{field.value}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* "fixed" repeats the column headings on every page of a long invoice. */}
        <View style={styles.tableHeader} fixed>
          <Text style={styles.colDescription}>Description</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colPrice}>Unit price</Text>
          <Text style={styles.colAmount}>Amount</Text>
        </View>
        {invoice.lineItems.map((line, index) => (
          <View key={index} style={styles.tableRow} wrap={false}>
            <Text style={styles.colDescription}>{line.description}</Text>
            <Text style={[styles.colQty, styles.muted]}>{formatQuantity(line.quantity)}</Text>
            <Text style={[styles.colPrice, styles.muted]}>{formatCents(line.unitPriceCents)}</Text>
            <Text style={styles.colAmount}>{formatCents(lineTotalCents(line))}</Text>
          </View>
        ))}

        <View style={styles.totals} wrap={false}>
          <View style={styles.totalRow}>
            <Text style={styles.muted}>Subtotal</Text>
            <Text>{formatCents(totals.subtotalCents)}</Text>
          </View>
          {totals.discountCents > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.muted}>Discount</Text>
              <Text>-{formatCents(totals.discountCents)}</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.muted}>Tax ({formatTaxRate(invoice.taxRate)})</Text>
            <Text>{formatCents(totals.taxCents)}</Text>
          </View>
          {/* The accountant's double rule marks the final figure. */}
          <View style={styles.doubleRule} />
          <View style={[styles.totalRow, styles.amountDue]}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11, marginTop: 5 }}>
              Amount due
            </Text>
            <Text style={styles.amountDueValue}>{formatCents(totals.totalCents)}</Text>
          </View>
        </View>

        {invoice.notes.trim() !== "" && (
          <View style={styles.notes} wrap={false}>
            <Text style={styles.label}>Notes</Text>
            <Text style={{ marginTop: 3 }}>{invoice.notes}</Text>
          </View>
        )}

        {/* Repeated on every page of a long invoice, like the table headings. */}
        <Text style={styles.footer} fixed>
          {business.name} | Invoice {invoice.invoiceNumber}
        </Text>
      </Page>
    </Document>
  );
}

export function renderInvoicePdf(invoice: InvoiceRecord): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument invoice={invoice} />);
}

/** A safe file name such as "INV-2026-0001.pdf". */
export function invoicePdfFileName(invoice: InvoiceRecord): string {
  const safe = invoice.invoiceNumber.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${safe || "invoice"}.pdf`;
}
