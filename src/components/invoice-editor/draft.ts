import { calculateTotals, type Totals } from "@/lib/invoice-math";
import type { CustomFieldInput, InvoiceInput } from "@/lib/invoice-schema";
import { centsToInput, parseDecimal, parseDollarsToCents, positiveOrZero } from "@/lib/money";

/**
 * Editor state. Numeric inputs are kept as the strings people type ("1.",
 * "$20") and converted on the way out, so typing is never fought by the UI.
 */

export interface DraftLine {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

export interface DraftField extends CustomFieldInput {
  key: string;
}

export interface Draft {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  business: InvoiceInput["business"];
  customer: InvoiceInput["customer"];
  lineItems: DraftLine[];
  discount: string;
  taxRate: string;
  customFields: DraftField[];
  notes: string;
}

let keySeq = 0;
/** React list keys only; never rendered into the DOM, so SSR/client values may differ. */
const newKey = () => `k${(keySeq++).toString(36)}`;

export const emptyLine = (): DraftLine => ({
  key: newKey(),
  description: "",
  quantity: "1",
  unitPrice: "",
});

export function toDraft(invoice: InvoiceInput): Draft {
  return {
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    business: { ...invoice.business },
    customer: { ...invoice.customer },
    lineItems: invoice.lineItems.map((line) => ({
      key: newKey(),
      description: line.description,
      quantity: String(line.quantity),
      unitPrice:
        line.unitPriceCents === 0 && line.description === ""
          ? ""
          : centsToInput(line.unitPriceCents),
    })),
    discount: invoice.discountCents === 0 ? "" : centsToInput(invoice.discountCents),
    taxRate: invoice.taxRate === 0 ? "" : String(invoice.taxRate),
    customFields: invoice.customFields.map((field) => ({ ...field, key: newKey() })),
    notes: invoice.notes,
  };
}

/** Converts the draft into the API payload. Unparseable numbers become NaN so validation flags them. */
export function toPayload(draft: Draft): InvoiceInput {
  return {
    invoiceNumber: draft.invoiceNumber,
    issueDate: draft.issueDate,
    dueDate: draft.dueDate,
    business: draft.business,
    customer: draft.customer,
    lineItems: draft.lineItems.map((line) => ({
      description: line.description,
      quantity: parseDecimal(line.quantity),
      unitPriceCents: parseDollarsToCents(line.unitPrice),
    })),
    // Blank discount and tax mean zero; anything typed must be valid.
    discountCents: draft.discount.trim() === "" ? 0 : parseDollarsToCents(draft.discount),
    taxRate: draft.taxRate.trim() === "" ? 0 : parseDecimal(draft.taxRate.replace("%", "")),
    customFields: draft.customFields.map(({ label, value, visible }) => ({
      label,
      value,
      visible,
    })),
    notes: draft.notes,
  };
}

/**
 * What the live preview shows while someone is mid-edit: invalid numbers
 * count as zero and the discount is capped at the subtotal. The form shows
 * the matching errors; nothing here is ever saved.
 */
export function previewTotals(payload: InvoiceInput): Totals {
  const lineItems = payload.lineItems.map((line) => ({
    quantity: Math.round(positiveOrZero(line.quantity) * 100) / 100,
    unitPriceCents: Math.round(positiveOrZero(line.unitPriceCents)),
  }));
  const { subtotalCents } = calculateTotals({ lineItems, discountCents: 0, taxRate: 0 });
  return calculateTotals({
    lineItems,
    discountCents: Math.min(Math.round(positiveOrZero(payload.discountCents)), subtotalCents),
    taxRate: Math.min(positiveOrZero(payload.taxRate), 100),
  });
}

export type DraftAction =
  | { type: "replace"; draft: Draft }
  | {
      type: "setField";
      field: "invoiceNumber" | "issueDate" | "dueDate" | "discount" | "taxRate" | "notes";
      value: string;
    }
  | { type: "setParty"; party: "business" | "customer"; field: string; value: string }
  | { type: "addLine" }
  | { type: "updateLine"; key: string; patch: Partial<Omit<DraftLine, "key">> }
  | { type: "removeLine"; key: string }
  | { type: "addCustomField" }
  | { type: "updateCustomField"; key: string; patch: Partial<Omit<DraftField, "key">> }
  | { type: "removeCustomField"; key: string };

export function draftReducer(draft: Draft, action: DraftAction): Draft {
  switch (action.type) {
    case "replace":
      return action.draft;
    case "setField":
      return { ...draft, [action.field]: action.value };
    case "setParty":
      return { ...draft, [action.party]: { ...draft[action.party], [action.field]: action.value } };
    case "addLine":
      return { ...draft, lineItems: [...draft.lineItems, emptyLine()] };
    case "updateLine":
      return {
        ...draft,
        lineItems: draft.lineItems.map((line) =>
          line.key === action.key ? { ...line, ...action.patch } : line,
        ),
      };
    case "removeLine":
      return { ...draft, lineItems: draft.lineItems.filter((line) => line.key !== action.key) };
    case "addCustomField":
      return {
        ...draft,
        customFields: [
          ...draft.customFields,
          { key: newKey(), label: "", value: "", visible: true },
        ],
      };
    case "updateCustomField":
      return {
        ...draft,
        customFields: draft.customFields.map((field) =>
          field.key === action.key ? { ...field, ...action.patch } : field,
        ),
      };
    case "removeCustomField":
      return {
        ...draft,
        customFields: draft.customFields.filter((field) => field.key !== action.key),
      };
  }
}

/**
 * Error paths are index-based ("lineItems.2.quantity"). After removing row `index`
 * from `list`, drop that row's paths and move later rows up by one, so errors stay
 * attached to the right row.
 */
export function shiftPathsAfterRemoval(
  paths: Set<string>,
  list: "lineItems" | "customFields",
  index: number,
): Set<string> {
  const next = new Set<string>();
  for (const path of paths) {
    const [head, rowText, ...rest] = path.split(".");
    const row = Number(rowText);
    if (head !== list || rowText === undefined || row < index) next.add(path);
    else if (row > index) next.add([list, row - 1, ...rest].join("."));
  }
  return next;
}
