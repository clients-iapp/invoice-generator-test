/**
 * Adds one fictional demo invoice so the app has something to show.
 * Run with `npm run seed` (reads MONGODB_URI from .env.local).
 */
import mongoose from "mongoose";
import { invoiceInputSchema } from "../src/lib/invoice-schema";
import { createInvoice, suggestInvoiceNumber } from "../src/lib/invoices";
import { addDays, todayIso } from "../src/lib/format";

async function main() {
  const issueDate = todayIso();
  const input = invoiceInputSchema.parse({
    invoiceNumber: await suggestInvoiceNumber(),
    issueDate,
    dueDate: addDays(issueDate, 14),
    business: {
      name: "Juniper & Pine Woodworks",
      email: "billing@juniperpine.example",
      phone: "(555) 010-2244",
      address: "41 Cedar Row\nPortland, OR 97205",
    },
    customer: {
      name: "Harbor Lane Cafe",
      email: "owner@harborlane.example",
      address: "908 Harbor Lane\nPortland, OR 97209",
    },
    lineItems: [
      { description: "Walnut counter shelving, custom fit", quantity: 2, unitPriceCents: 5000 },
      { description: "On-site installation (hours)", quantity: 1.5, unitPriceCents: 6500 },
      { description: "Food-safe oil finish", quantity: 3, unitPriceCents: 1299 },
    ],
    discountCents: 1000,
    taxRate: 10,
    customFields: [
      { label: "PO number", value: "HLC-2207", visible: true },
      { label: "Project", value: "Front counter refit", visible: true },
      { label: "Internal note", value: "Quoted at 15% margin", visible: false },
    ],
    notes: "Thank you for your business. Payment by bank transfer within 14 days.",
  });

  const invoice = await createInvoice(input);
  console.log(`Created ${invoice.invoiceNumber} (${invoice.id})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
