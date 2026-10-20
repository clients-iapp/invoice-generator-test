import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as invoicesRoute from "@/app/api/invoices/route";
import * as pdfRoute from "@/app/api/invoices/[id]/pdf/route";
import * as invoiceRoute from "@/app/api/invoices/[id]/route";
import * as sendRoute from "@/app/api/invoices/[id]/send/route";
import { connectToDatabase } from "@/lib/db";
import { suggestInvoiceNumber } from "@/lib/invoices";
import type { InvoiceInput } from "@/lib/invoice-schema";
import type { InvoiceRecord } from "@/lib/invoice-types";
import { MailerNotConfiguredError, sendEmail } from "@/lib/mailer";
import { Invoice } from "@/models/Invoice";

// connection() only works inside a real Next.js request; outside one it is a no-op for these tests.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

vi.mock("@/lib/mailer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mailer")>()),
  sendEmail: vi.fn(),
}));

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri("invoice_generator_test");
  await connectToDatabase();
  await Invoice.init(); // build the unique index on invoiceNumber
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Invoice.deleteMany({});
  vi.mocked(sendEmail).mockReset();
});

const sample: InvoiceInput = {
  invoiceNumber: "INV-2026-0001",
  issueDate: "2026-10-01",
  dueDate: "2026-10-31",
  business: {
    name: "Juniper & Pine Woodworks",
    email: "billing@juniperpine.example",
    phone: "",
    address: "",
  },
  customer: { name: "Harbor Lane Cafe", email: "owner@harborlane.example", address: "" },
  lineItems: [{ description: "Oak shelving", quantity: 2, unitPriceCents: 5000 }],
  discountCents: 1000,
  taxRate: 10,
  customFields: [
    { label: "PO number", value: "PO-7731", visible: true },
    { label: "Internal margin", value: "secret-42", visible: false },
  ],
  notes: "Thank you!",
};

function jsonRequest(method: string, body: unknown) {
  return new Request("http://localhost/api", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

async function createSample(overrides: Partial<InvoiceInput> = {}): Promise<InvoiceRecord> {
  const response = await invoicesRoute.POST(jsonRequest("POST", { ...sample, ...overrides }));
  expect(response.status).toBe(201);
  return (await response.json()).invoice;
}

describe("invoices API", () => {
  it("saves an invoice and returns the same data when read back", async () => {
    const created = await createSample();
    const response = await invoiceRoute.GET(new Request("http://localhost"), ctx(created.id));
    const { invoice } = await response.json();

    expect(response.status).toBe(200);
    expect(invoice).toMatchObject({ ...sample, status: "draft" });
    expect(invoice.totals).toEqual({
      subtotalCents: 10000,
      discountCents: 1000,
      taxableCents: 9000,
      taxCents: 900,
      totalCents: 9900,
    });
  });

  it("recalculates totals on the server and ignores totals sent by the client", async () => {
    const created = await createSample({ totals: { totalCents: 1 } } as Partial<InvoiceInput>);
    expect(created.totals.totalCents).toBe(9900);
  });

  it("rejects invalid input with field-level errors", async () => {
    const response = await invoicesRoute.POST(
      jsonRequest("POST", {
        ...sample,
        discountCents: 20000,
        lineItems: [{ description: "", quantity: -1, unitPriceCents: 100 }],
      }),
    );
    const { error } = await response.json();

    expect(response.status).toBe(400);
    expect(error.fieldErrors).toMatchObject({
      "lineItems.0.description": "Description is required",
      "lineItems.0.quantity": "Quantity can't be negative",
    });
  });

  it("rejects non-JSON content types, which blocks cross-site form posts", async () => {
    const response = await invoicesRoute.POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: JSON.stringify(sample),
      }),
    );
    expect(response.status).toBe(415);
    expect(await Invoice.countDocuments()).toBe(0);
  });

  it("rejects malformed JSON", async () => {
    const response = await invoicesRoute.POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not json",
      }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.message).toBe("The request body isn't valid JSON.");
  });

  it("returns 409 for a duplicate invoice number", async () => {
    await createSample();
    const response = await invoicesRoute.POST(jsonRequest("POST", sample));
    expect(response.status).toBe(409);
    expect((await response.json()).error.fieldErrors.invoiceNumber).toMatch(/already used/);
  });

  it("updates an invoice and recalculates its totals", async () => {
    const created = await createSample();
    const response = await invoiceRoute.PUT(
      jsonRequest("PUT", {
        ...sample,
        lineItems: [{ description: "Oak shelving", quantity: 3, unitPriceCents: 5000 }],
      }),
      ctx(created.id),
    );
    const { invoice } = await response.json();
    expect(invoice.totals.totalCents).toBe(15400); // (150 - 10) * 1.10
  });

  it("returns 404 for unknown or malformed ids", async () => {
    const unknown = await invoiceRoute.GET(
      new Request("http://localhost"),
      ctx(new mongoose.Types.ObjectId().toString()),
    );
    const malformed = await invoiceRoute.GET(new Request("http://localhost"), ctx("not-an-id"));
    expect(unknown.status).toBe(404);
    expect(malformed.status).toBe(404);
  });

  it("suggests the next invoice number numerically, past 9999", async () => {
    await createSample({ invoiceNumber: "INV-2026-0002" });
    await createSample({ invoiceNumber: "INV-2026-9999" });
    expect(await suggestInvoiceNumber(2026)).toBe("INV-2026-10000");
    expect(await suggestInvoiceNumber(2027)).toBe("INV-2027-0001");
  });

  it("lists saved invoices", async () => {
    await createSample();
    const { invoices } = await (await invoicesRoute.GET()).json();
    expect(invoices).toEqual([
      expect.objectContaining({
        invoiceNumber: "INV-2026-0001",
        customerName: "Harbor Lane Cafe",
        totalCents: 9900,
      }),
    ]);
  });
});

describe("send invoice email", () => {
  it("emails the saved invoice and marks it as sent", async () => {
    const created = await createSample({
      lineItems: [{ description: "<script>alert(1)</script>", quantity: 2, unitPriceCents: 5000 }],
    });
    const response = await sendRoute.POST(
      jsonRequest("POST", { to: "me@example.com", subject: "", message: "Hi there" }),
      ctx(created.id),
    );
    const { invoice } = await response.json();

    expect(response.status).toBe(200);
    expect(invoice.status).toBe("sent");
    expect(invoice.lastSentTo).toBe("me@example.com");

    const email = vi.mocked(sendEmail).mock.calls[0][0];
    expect(email.to).toBe("me@example.com");
    expect(email.subject).toBe("Invoice INV-2026-0001 from Juniper & Pine Woodworks");
    expect(email.replyTo).toBe("billing@juniperpine.example");
    expect(email.html).toContain("$99.00");
    expect(email.html).toContain("PO-7731");
    expect(email.html).not.toContain("secret-42"); // hidden custom field
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).toContain("A PDF copy is attached: INV-2026-0001.pdf");
    expect(email.attachments).toHaveLength(1);
    expect(email.attachments?.[0]).toMatchObject({
      filename: "INV-2026-0001.pdf",
      contentType: "application/pdf",
    });
    expect(email.attachments?.[0].content.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("explains when SMTP isn't configured", async () => {
    const created = await createSample();
    vi.mocked(sendEmail).mockRejectedValueOnce(new MailerNotConfiguredError(["SMTP_HOST"]));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});

    const response = await sendRoute.POST(
      jsonRequest("POST", { to: "me@example.com", subject: "", message: "" }),
      ctx(created.id),
    );

    expect(response.status).toBe(503);
    expect((await Invoice.findById(created.id).lean())?.status).toBe("draft");
  });

  it("limits sends per invoice", async () => {
    const created = await createSample();
    const send = () =>
      sendRoute.POST(
        jsonRequest("POST", { to: "me@example.com", subject: "", message: "" }),
        ctx(created.id),
      );
    for (let i = 0; i < 5; i++) expect((await send()).status).toBe(200);
    const limited = await send();
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
    expect(sendEmail).toHaveBeenCalledTimes(5);
  });

  it("returns 404 if the invoice is deleted while the email is being sent", async () => {
    const created = await createSample();
    vi.mocked(sendEmail).mockImplementationOnce(async () => {
      await Invoice.deleteMany({});
    });
    const response = await sendRoute.POST(
      jsonRequest("POST", { to: "me@example.com", subject: "", message: "" }),
      ctx(created.id),
    );
    expect(response.status).toBe(404);
  });

  it("validates the recipient address", async () => {
    const created = await createSample();
    const response = await sendRoute.POST(
      jsonRequest("POST", { to: "nope", subject: "", message: "" }),
      ctx(created.id),
    );
    expect(response.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("invoice PDF", () => {
  it("serves the saved invoice as a PDF, or 404", async () => {
    const created = await createSample();
    const response = await pdfRoute.GET(new Request("http://localhost"), ctx(created.id));
    const bytes = Buffer.from(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain('filename="INV-2026-0001.pdf"');
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");

    const missing = await pdfRoute.GET(
      new Request("http://localhost"),
      ctx(new mongoose.Types.ObjectId().toString()),
    );
    expect(missing.status).toBe(404);
  });
});
