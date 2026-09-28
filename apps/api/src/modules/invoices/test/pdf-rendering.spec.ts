import { describe, it, expect } from "vitest";
import { createInvoicePdf } from "../invoice-pdf";
import { invoiceBusinessDetails, invoiceBusinessLogo } from "../invoice-business";
import type { InvoiceDocument } from "../types";
const invoice: InvoiceDocument = {
  invoiceNumber: "INV-TEST",
  createdAt: new Date("2026-09-24"),
  customer: "Ada",
  customerEmail: "ada@example.test",
  currency: "NGN",
  subtotalKobo: 20000,
  discountKobo: 0,
  taxKobo: 0,
  totalKobo: 20000,
  dueDate: new Date("2026-10-01"),
  notes: "Thank you",
  businessDetails: {
    address: "10 Market Road",
    shopNumber: "12",
    phone: "08012345678",
    email: "shop@example.test",
    registrationNumber: "RC123",
  },
  items: [{ description: "Rice", quantity: 2, unitPriceKobo: 10000, totalKobo: 20000 }],
};
describe("downloaded invoice", () => {
  it("renders a valid PDF with a fallback logo and multiple pages for a long invoice", async () => {
    const pdf = await createInvoicePdf(
      {
        ...invoice,
        businessLogo: "invalid",
        items: Array.from({ length: 30 }, () => invoice.items[0]),
      },
      "Ada shop",
    );
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.toString("latin1").match(/\/Type \/Page\b/g)!.length).toBeGreaterThan(1);
    expect(pdf.subarray(-7).toString()).toContain("%%EOF");
  });
  it("accepts only supported embedded logos and validated business details", () => {
    expect(invoiceBusinessLogo("https://remote.test/logo.png")).toBeUndefined();
    expect(invoiceBusinessLogo("data:image/png;base64,AAAA")).toContain("data:image/png");
    expect(
      invoiceBusinessDetails(
        '{"businessDetails":{"address":"10 Market Road","email":"shop@example.test"}}',
      ),
    ).toEqual({ address: "10 Market Road", email: "shop@example.test" });
    expect(invoiceBusinessDetails("invalid json")).toEqual({});
    expect(invoiceBusinessDetails('{"businessDetails":{"email":"invalid"}}')).toEqual({});
  });
});
