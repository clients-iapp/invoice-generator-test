import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "./db";
import { calculateTotals } from "./invoice-math";
import type { InvoiceInput, LineItemInput } from "./invoice-schema";
import type { InvoiceRecord, InvoiceStatus, InvoiceSummary, StoredTotals } from "./invoice-types";
import { Invoice } from "@/models/Invoice";

/**
 * Data access for invoices. API routes and server-rendered pages both go
 * through here, so totals are always recalculated on the server before saving.
 */

/** A saved invoice as returned by .lean(); the schema guarantees these fields. */
type StoredInvoice = InvoiceInput & {
  _id: unknown;
  lineItems: (LineItemInput & { amountCents: number })[];
  totals: StoredTotals;
  status: InvoiceStatus;
  sentAt: Date | null;
  lastSentTo: string;
  createdAt: Date;
  updatedAt: Date;
};

function toRecord(doc: StoredInvoice): InvoiceRecord {
  return {
    id: String(doc._id),
    invoiceNumber: doc.invoiceNumber,
    issueDate: doc.issueDate,
    dueDate: doc.dueDate,
    business: {
      name: doc.business.name,
      email: doc.business.email,
      phone: doc.business.phone,
      address: doc.business.address,
    },
    customer: { name: doc.customer.name, email: doc.customer.email, address: doc.customer.address },
    lineItems: doc.lineItems.map(({ description, quantity, unitPriceCents }) => ({
      description,
      quantity,
      unitPriceCents,
    })),
    customFields: doc.customFields.map(({ label, value, visible }) => ({ label, value, visible })),
    discountCents: doc.discountCents,
    taxRate: doc.taxRate,
    notes: doc.notes,
    totals: {
      subtotalCents: doc.totals.subtotalCents,
      discountCents: doc.totals.discountCents,
      taxableCents: doc.totals.taxableCents,
      taxCents: doc.totals.taxCents,
      totalCents: doc.totals.totalCents,
    },
    status: doc.status,
    sentAt: doc.sentAt ? doc.sentAt.toISOString() : null,
    lastSentTo: doc.lastSentTo,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** Adds server-calculated line amounts and totals to validated input. */
function withTotals(input: InvoiceInput) {
  const { lineTotalsCents, ...totals } = calculateTotals(input);
  return {
    ...input,
    lineItems: input.lineItems.map((line, index) => ({
      ...line,
      amountCents: lineTotalsCents[index],
    })),
    totals,
  };
}

export async function listInvoices(): Promise<InvoiceSummary[]> {
  await connectToDatabase();
  const docs = await Invoice.find(
    {},
    { invoiceNumber: 1, customer: 1, issueDate: 1, dueDate: 1, totals: 1, status: 1, updatedAt: 1 },
  )
    .sort({ updatedAt: -1 })
    .limit(200)
    .lean<StoredInvoice[]>();

  return docs.map((doc) => ({
    id: String(doc._id),
    invoiceNumber: doc.invoiceNumber,
    customerName: doc.customer.name,
    issueDate: doc.issueDate,
    dueDate: doc.dueDate,
    totalCents: doc.totals.totalCents,
    status: doc.status,
    updatedAt: doc.updatedAt.toISOString(),
  }));
}

export async function getInvoice(id: string): Promise<InvoiceRecord | null> {
  if (!isValidObjectId(id)) return null;
  await connectToDatabase();
  const doc = await Invoice.findById(id).lean<StoredInvoice>();
  return doc ? toRecord(doc) : null;
}

export async function createInvoice(input: InvoiceInput): Promise<InvoiceRecord> {
  await connectToDatabase();
  const doc = await Invoice.create(withTotals(input));
  return toRecord(doc.toObject() as unknown as StoredInvoice);
}

export async function updateInvoice(
  id: string,
  input: InvoiceInput,
): Promise<InvoiceRecord | null> {
  if (!isValidObjectId(id)) return null;
  await connectToDatabase();
  const doc = await Invoice.findByIdAndUpdate(id, withTotals(input), {
    returnDocument: "after",
    runValidators: true,
  }).lean<StoredInvoice>();
  return doc ? toRecord(doc) : null;
}

export async function deleteInvoice(id: string): Promise<boolean> {
  if (!isValidObjectId(id)) return false;
  await connectToDatabase();
  const result = await Invoice.deleteOne({ _id: id });
  return result.deletedCount === 1;
}

export async function markInvoiceSent(id: string, sentTo: string): Promise<InvoiceRecord | null> {
  await connectToDatabase();
  const doc = await Invoice.findByIdAndUpdate(
    id,
    { status: "sent", sentAt: new Date(), lastSentTo: sentTo },
    { returnDocument: "after" },
  ).lean<StoredInvoice>();
  return doc ? toRecord(doc) : null;
}

/** Next number in the INV-YYYY-0001 sequence for the given year (compared as numbers). */
export async function suggestInvoiceNumber(year = new Date().getFullYear()): Promise<string> {
  await connectToDatabase();
  const prefix = `INV-${year}-`;
  const [latest] = await Invoice.aggregate<{ seq: number }>([
    { $match: { invoiceNumber: { $regex: `^${prefix}\\d{1,15}$` } } },
    { $project: { seq: { $toLong: { $substrCP: ["$invoiceNumber", prefix.length, 15] } } } },
    { $sort: { seq: -1 } },
    { $limit: 1 },
  ]);
  const next = latest ? Number(latest.seq) + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

/** Business details from the most recent invoice, so a new invoice starts pre-filled. */
export async function latestBusinessDetails(): Promise<InvoiceInput["business"] | null> {
  await connectToDatabase();
  const latest = await Invoice.findOne({}, { business: 1 })
    .sort({ createdAt: -1 })
    .lean<StoredInvoice>();
  if (!latest) return null;
  const { name, email, phone, address } = latest.business;
  return { name, email, phone, address };
}

export function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}
