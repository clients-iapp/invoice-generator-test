import { describe, expect, it } from "vitest";
import { type InvoiceInput, invoiceInputSchema, toFieldErrors } from "@/lib/invoice-schema";
import { parseDecimal, parseDollarsToCents } from "@/lib/money";

function validInvoice(overrides: Partial<InvoiceInput> = {}): InvoiceInput {
  return {
    invoiceNumber: "INV-2026-0001",
    issueDate: "2026-10-01",
    dueDate: "2026-10-31",
    business: { name: "Juniper & Pine Woodworks", email: "", phone: "", address: "" },
    customer: { name: "Harbor Lane Cafe", email: "owner@harborlane.example", address: "" },
    lineItems: [{ description: "Oak shelving", quantity: 2, unitPriceCents: 5000 }],
    discountCents: 1000,
    taxRate: 10,
    customFields: [],
    notes: "",
    ...overrides,
  };
}

function errorsFor(input: unknown) {
  const result = invoiceInputSchema.safeParse(input);
  return result.success ? {} : toFieldErrors(result.error);
}

describe("invoiceInputSchema", () => {
  it("accepts a valid invoice", () => {
    expect(invoiceInputSchema.safeParse(validInvoice()).success).toBe(true);
  });

  it("rejects negative quantity, price, discount and tax", () => {
    const errors = errorsFor(
      validInvoice({
        lineItems: [{ description: "Oak shelving", quantity: -1, unitPriceCents: -500 }],
        discountCents: -1,
        taxRate: -5,
      }),
    );
    expect(errors["lineItems.0.quantity"]).toBe("Quantity can't be negative");
    expect(errors["lineItems.0.unitPriceCents"]).toBe("Price can't be negative");
    expect(errors.discountCents).toBe("Discount can't be negative");
    expect(errors.taxRate).toBe("Tax rate can't be negative");
  });

  it("rejects a discount larger than the subtotal", () => {
    const errors = errorsFor(validInvoice({ discountCents: 10001 }));
    expect(errors.discountCents).toBe("Discount can't be more than the subtotal ($100.00)");
  });

  it("still reports the discount problem alongside other field errors", () => {
    const errors = errorsFor(
      validInvoice({
        lineItems: [{ description: "", quantity: 1, unitPriceCents: 100 }],
        discountCents: 500,
      }),
    );
    expect(errors["lineItems.0.description"]).toBe("Description is required");
    expect(errors.discountCents).toMatch(/more than the subtotal/);
  });

  it("rejects a due date before the issue date and tax above 100%", () => {
    const errors = errorsFor(validInvoice({ dueDate: "2026-09-30", taxRate: 101 }));
    expect(errors.dueDate).toBe("Due date can't be before the issue date");
    expect(errors.taxRate).toBe("Tax rate can't be more than 100%");
  });

  it("requires at least one line item and valid emails", () => {
    const errors = errorsFor(
      validInvoice({
        lineItems: [],
        customer: { name: "Harbor Lane Cafe", email: "not-an-email", address: "" },
      }),
    );
    expect(errors.lineItems).toBe("Add at least one line item");
    expect(errors["customer.email"]).toMatch(/valid email/);
  });

  it("does not let custom fields affect validation of totals", () => {
    const input = validInvoice({
      customFields: [
        { label: "PO number", value: "PO-7731", visible: true },
        { label: "Internal ref", value: "-500", visible: false },
      ],
    });
    expect(invoiceInputSchema.safeParse(input).success).toBe(true);
  });

  it("rejects numbers with hidden extra precision that the editor couldn't show", () => {
    const errors = errorsFor(
      validInvoice({
        lineItems: [{ description: "Oak shelving", quantity: 1.000000001, unitPriceCents: 5000 }],
        taxRate: 8.8750000001,
      }),
    );
    expect(errors["lineItems.0.quantity"]).toBe("Quantity can have at most 2 decimal places");
    expect(errors.taxRate).toBe("Tax rate can have at most 3 decimal places");
    expect(invoiceInputSchema.safeParse(validInvoice({ taxRate: 8.875 })).success).toBe(true);
  });

  it("strips unknown keys such as client-sent totals or Mongo operators", () => {
    const parsed = invoiceInputSchema.parse({ ...validInvoice(), totalCents: 1, $where: "1" });
    expect(parsed).not.toHaveProperty("totalCents");
    expect(parsed).not.toHaveProperty("$where");
  });
});

describe("money parsing", () => {
  it("parses dollars into exact cents", () => {
    expect(parseDollarsToCents("0.29")).toBe(29);
    expect(parseDollarsToCents("$1,234.5")).toBe(123450);
    expect(parseDollarsToCents("-10")).toBe(-1000);
    expect(parseDollarsToCents("10.500")).toBe(1050);
    expect(Number.isInteger(parseDollarsToCents("1.234"))).toBe(false); // flagged by the schema
    expect(parseDollarsToCents("")).toBeNaN();
    expect(parseDollarsToCents("abc")).toBeNaN();
  });

  it("only accepts commas as thousands separators and never guesses", () => {
    expect(parseDollarsToCents("1,234,567.89")).toBe(123456789);
    expect(parseDollarsToCents("-$10")).toBe(-1000);
    expect(parseDollarsToCents("12,34")).toBeNaN();
    expect(parseDollarsToCents("1 2")).toBeNaN();
    expect(parseDollarsToCents("$ 10")).toBeNaN();
    expect(parseDecimal("1,000")).toBe(1000);
    expect(parseDecimal("$5")).toBeNaN();
  });

  it("parses decimals with a precision limit", () => {
    expect(parseDecimal("1.5")).toBe(1.5);
    expect(parseDecimal("8.8750")).toBe(8.875);
    expect(parseDecimal("1.555")).toBe(1.555); // the schema rejects it with a clear message
    expect(parseDecimal(".")).toBeNaN();
  });
});
