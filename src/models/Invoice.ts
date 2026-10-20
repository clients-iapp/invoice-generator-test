import { type InferSchemaType, type Model, Schema, model, models } from "mongoose";

// Line items and custom fields are embedded: they are always read and written
// together with their invoice, so one document per invoice keeps saves atomic.
const lineItemSchema = new Schema(
  {
    description: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPriceCents: { type: Number, required: true },
    amountCents: { type: Number, required: true },
  },
  { _id: false },
);

const customFieldSchema = new Schema(
  {
    label: { type: String, required: true },
    value: { type: String, default: "" },
    visible: { type: Boolean, default: true },
  },
  { _id: false },
);

const invoiceSchema = new Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    // Calendar dates stored as YYYY-MM-DD so they never shift with time zones.
    issueDate: { type: String, required: true },
    dueDate: { type: String, required: true },
    business: {
      name: { type: String, required: true },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
      address: { type: String, default: "" },
    },
    customer: {
      name: { type: String, required: true },
      email: { type: String, default: "" },
      address: { type: String, default: "" },
    },
    lineItems: { type: [lineItemSchema], default: [] },
    customFields: { type: [customFieldSchema], default: [] },
    discountCents: { type: Number, required: true },
    taxRate: { type: Number, required: true },
    notes: { type: String, default: "" },
    // Always calculated on the server from the fields above.
    totals: {
      subtotalCents: { type: Number, required: true },
      discountCents: { type: Number, required: true },
      taxableCents: { type: Number, required: true },
      taxCents: { type: Number, required: true },
      totalCents: { type: Number, required: true },
    },
    status: { type: String, enum: ["draft", "sent"], default: "draft" },
    sentAt: { type: Date, default: null },
    lastSentTo: { type: String, default: "" },
  },
  { timestamps: true },
);

export type InvoiceDocument = InferSchemaType<typeof invoiceSchema>;

export const Invoice: Model<InvoiceDocument> =
  (models.Invoice as Model<InvoiceDocument> | undefined) ?? model("Invoice", invoiceSchema);
