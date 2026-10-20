import { describe, expect, it } from "vitest";
import {
  previewTotals,
  shiftPathsAfterRemoval,
  toDraft,
  toPayload,
} from "@/components/invoice-editor/draft";
import { type InvoiceInput, invoiceInputSchema, toFieldErrors } from "@/lib/invoice-schema";

const invoice: InvoiceInput = {
  invoiceNumber: "INV-2026-0001",
  issueDate: "2026-10-01",
  dueDate: "2026-10-31",
  business: { name: "Juniper & Pine Woodworks", email: "", phone: "", address: "" },
  customer: { name: "Harbor Lane Cafe", email: "", address: "" },
  lineItems: [{ description: "Oak shelving", quantity: 1.5, unitPriceCents: 4999 }],
  discountCents: 0,
  taxRate: 8.875,
  customFields: [{ label: "PO", value: "7731", visible: false }],
  notes: "",
};

describe("editor draft", () => {
  it("round-trips a saved invoice through the editor without changes", () => {
    expect(toPayload(toDraft(invoice))).toEqual(invoice);
  });

  it("previews mid-edit input safely: bad numbers count as zero, discount is capped", () => {
    const draft = toDraft(invoice);
    draft.lineItems[0] = { ...draft.lineItems[0], quantity: "abc", unitPrice: "10" };
    draft.discount = "50";
    expect(previewTotals(toPayload(draft)).totalCents).toBe(0);
  });

  it("keeps error paths on the right row after a row is removed", () => {
    const touched = new Set([
      "customer.name",
      "lineItems",
      "lineItems.0.quantity",
      "lineItems.1.description",
      "lineItems.2.unitPriceCents",
      "customFields.0.label",
    ]);
    expect(shiftPathsAfterRemoval(touched, "lineItems", 1)).toEqual(
      new Set([
        "customer.name",
        "lineItems",
        "lineItems.0.quantity",
        "lineItems.1.unitPriceCents",
        "customFields.0.label",
      ]),
    );
  });

  it("explains extra decimal places instead of a generic message", () => {
    const draft = toDraft(invoice);
    draft.lineItems[0] = { ...draft.lineItems[0], quantity: "1.005", unitPrice: "1.234" };
    draft.taxRate = "8.8750";
    const result = invoiceInputSchema.safeParse(toPayload(draft));
    const errors = result.success ? {} : toFieldErrors(result.error);
    expect(errors["lineItems.0.quantity"]).toBe("Quantity can have at most 2 decimal places");
    expect(errors["lineItems.0.unitPriceCents"]).toBe("Price can have at most 2 decimal places");
    expect(errors.taxRate).toBeUndefined();
  });
});
