import type { InvoiceInput } from "./invoice-schema";

/** Shapes sent to the browser. Kept free of Mongoose imports so client code can use them. */

export type InvoiceStatus = "draft" | "sent";

export interface StoredTotals {
  subtotalCents: number;
  discountCents: number;
  taxableCents: number;
  taxCents: number;
  totalCents: number;
}

export interface InvoiceRecord extends InvoiceInput {
  id: string;
  totals: StoredTotals;
  status: InvoiceStatus;
  sentAt: string | null;
  lastSentTo: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceSummary {
  id: string;
  invoiceNumber: string;
  customerName: string;
  issueDate: string;
  dueDate: string;
  totalCents: number;
  status: InvoiceStatus;
  updatedAt: string;
}
