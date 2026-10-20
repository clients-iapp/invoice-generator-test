import { z } from "zod";
import { calculateTotals } from "./invoice-math";
import { formatCents } from "./money";

/**
 * One validation schema for the editor (inline errors) and the API (the source
 * of truth). Unknown keys are stripped, so request bodies can't smuggle extra
 * fields or MongoDB operators into the database.
 */

export const LIMITS = {
  lineItems: 100,
  customFields: 20,
  quantity: 100_000,
  moneyCents: 100_000_000, // $1,000,000
} as const;

/** Exact: 1.15 passes for 2 places, 1.000000001 does not (it couldn't be shown in the editor). */
function hasMaxDecimals(places: number) {
  const factor = 10 ** places;
  return (n: number) => Math.round(n * factor) / factor === n;
}

const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} must be ${max} characters or fewer` });

const requiredText = (label: string, max: number) =>
  optionalText(label, max).min(1, { error: `${label} is required` });

const optionalEmail = optionalText("Email", 254).refine(
  (value) => value === "" || z.email().safeParse(value).success,
  { error: "Enter a valid email address, like name@example.com" },
);

const moneyCents = (label: string) =>
  z
    .number({ error: `Enter a valid ${label.toLowerCase()}, like 49.99` })
    .int({ error: `${label} can have at most 2 decimal places` })
    .min(0, { error: `${label} can't be negative` })
    .max(LIMITS.moneyCents, {
      error: `${label} must be ${formatCents(LIMITS.moneyCents)} or less`,
    });

export const lineItemSchema = z.object({
  description: requiredText("Description", 300),
  quantity: z
    .number({ error: "Enter a quantity, like 2 or 1.5" })
    .min(0, { error: "Quantity can't be negative" })
    .max(LIMITS.quantity, { error: `Quantity must be ${LIMITS.quantity.toLocaleString()} or less` })
    .refine(hasMaxDecimals(2), { error: "Quantity can have at most 2 decimal places" }),
  unitPriceCents: moneyCents("Price"),
});

export const customFieldSchema = z.object({
  label: requiredText("Label", 60),
  value: optionalText("Value", 300),
  visible: z.boolean(),
});

export const invoiceInputSchema = z
  .object({
    invoiceNumber: requiredText("Invoice number", 40),
    issueDate: z.iso.date({ error: "Pick an issue date" }),
    dueDate: z.iso.date({ error: "Pick a due date" }),
    business: z.object({
      name: requiredText("Business name", 120),
      email: optionalEmail,
      phone: optionalText("Phone", 40),
      address: optionalText("Address", 500),
    }),
    customer: z.object({
      name: requiredText("Customer name", 120),
      email: optionalEmail,
      address: optionalText("Address", 500),
    }),
    lineItems: z
      .array(lineItemSchema)
      .min(1, { error: "Add at least one line item" })
      .max(LIMITS.lineItems, { error: `An invoice can have up to ${LIMITS.lineItems} line items` }),
    discountCents: moneyCents("Discount"),
    taxRate: z
      .number({ error: "Enter a tax rate, like 8.5" })
      .min(0, { error: "Tax rate can't be negative" })
      .max(100, { error: "Tax rate can't be more than 100%" })
      .refine(hasMaxDecimals(3), { error: "Tax rate can have at most 3 decimal places" }),
    customFields: z
      .array(customFieldSchema)
      .max(LIMITS.customFields, { error: `Up to ${LIMITS.customFields} custom fields` }),
    notes: optionalText("Notes", 2000),
  })
  .superRefine((invoice, ctx) => {
    if (invoice.dueDate < invoice.issueDate) {
      ctx.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "Due date can't be before the issue date",
      });
    }

    // Only compare the discount once every amount is a usable number;
    // the field-level rules above already explain any bad amount.
    const amountsUsable =
      Number.isInteger(invoice.discountCents) &&
      invoice.lineItems.every(
        (line) =>
          Number.isInteger(line.unitPriceCents) &&
          line.unitPriceCents >= 0 &&
          Number.isFinite(line.quantity) &&
          line.quantity >= 0,
      );
    if (!amountsUsable) return;

    const { subtotalCents } = calculateTotals({
      lineItems: invoice.lineItems,
      discountCents: 0,
      taxRate: 0,
    });
    if (invoice.discountCents > subtotalCents) {
      ctx.addIssue({
        code: "custom",
        path: ["discountCents"],
        message: `Discount can't be more than the subtotal (${formatCents(subtotalCents)})`,
      });
    }
  });

export type InvoiceInput = z.infer<typeof invoiceInputSchema>;
export type LineItemInput = z.infer<typeof lineItemSchema>;
export type CustomFieldInput = z.infer<typeof customFieldSchema>;

export const sendInvoiceSchema = z.object({
  to: z
    .string()
    .trim()
    .min(1, { error: "Enter the recipient's email" })
    .pipe(z.email({ error: "Enter a valid email address, like name@example.com" })),
  subject: optionalText("Subject", 200),
  message: optionalText("Message", 2000),
});

export type SendInvoiceInput = z.infer<typeof sendInvoiceSchema>;

/** Flattens Zod issues to { "lineItems.0.quantity": "message" }, first message per field. */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    fieldErrors[key] ??= issue.message;
  }
  return fieldErrors;
}
