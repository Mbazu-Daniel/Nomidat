// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { api, render, change, submit, click, button } from "./render";
import { SaleDetail } from "../sale-detail";
import { RecordDetail } from "../record-detail";
import { SalesRegister } from "../sales-register";
import { InvoiceDetailPanel } from "../invoice-detail";
import type { InvoiceDetail } from "../types";
const record = { id: "sale", createdAt: "2026-09-24T10:00:00Z" };
const invoice: InvoiceDetail = {
  ...record,
  invoiceNumber: "INV-1",
  dueDate: null,
  notes: null,
  businessName: "Ada shop",
  businessLogo: "data:image/png;base64,AA==",
  businessDetails: {
    address: "10 Market Road",
    phone: "08012345678",
    shopNumber: "12",
    registrationNumber: "RC123",
    email: "ada@example.test",
  },
  subtotalKobo: 40000,
  taxKobo: 0,
  discountKobo: 0,
  totalKobo: 40000,
  items: [{ id: "line", description: "Rice", quantity: 2, unitPriceKobo: 20000, totalKobo: 40000 }],
};
describe("payments and customer records", () => {
  it("shows the actual outstanding balance and rejects overpayment", async () => {
    api.mockResolvedValue({ totalKobo: 40000, paidKobo: 30000, balanceKobo: 10000 });
    const ui = await render(SaleDetail, {
      path: "/organizations/shop",
      record,
      canWrite: true,
      onSaved: vi.fn(),
    });
    expect(ui.textContent).toContain("Already paid");
    expect(ui.querySelector<HTMLInputElement>('[name="amount"]')?.max).toBe("100");
    await change(ui.querySelector('[name="amount"]'), "101");
    await submit(ui.querySelector("form"));
    expect(ui.textContent).toContain("Enter an additional payment");
    expect(api).toHaveBeenCalledTimes(1);
    await change(ui.querySelector('[name="amount"]'), "50");
    await submit(ui.querySelector("form"));
    expect(api).toHaveBeenLastCalledWith("/organizations/shop/sales/sale/payments", {
      method: "POST",
      body: '{"amountKobo":5000,"method":"cash"}',
    });
  });
  it("does not offer another payment when a sale is fully paid", async () => {
    api.mockResolvedValue({ totalKobo: 40000, paidKobo: 40000, balanceKobo: 0 });
    const ui = await render(SaleDetail, {
      path: "/organizations/shop",
      record,
      canWrite: true,
      onSaved: vi.fn(),
    });
    expect(ui.textContent).toContain("Fully paid");
    expect(ui.querySelector('[name="amount"]')).toBeNull();
    expect(button(ui, "Create invoice from sale")).not.toBeNull();
    await click(button(ui, "Create invoice from sale"));
    expect(api).toHaveBeenLastCalledWith("/organizations/shop/invoices/from-sales/sale", {
      method: "POST",
      body: "{}",
    });
  });
  it("hides financial write actions from read-only staff", async () => {
    api.mockResolvedValue({ totalKobo: 40000, paidKobo: 0, balanceKobo: 40000 });
    const ui = await render(SaleDetail, {
      path: "/organizations/shop",
      record,
      canWrite: false,
      onSaved: vi.fn(),
    });
    expect(ui.querySelector("form")).toBeNull();
    expect(button(ui, "Create invoice from sale")).toBeNull();
    expect(ui.textContent).toContain("Outstanding balance");
  });
  it("displays partial, paid, unpaid and cancelled states independently", async () => {
    const ui = await render(SalesRegister, {
      rows: [
        { ...record, id: "partial", totalKobo: 40000, paidKobo: 10000 },
        { ...record, id: "paid", totalKobo: 40000, paidKobo: 40000 },
        { ...record, id: "unpaid", totalKobo: 40000, paidKobo: 0 },
        { ...record, id: "cancelled", status: "cancelled", balanceKobo: 0 },
      ],
      onSelect: vi.fn(),
    });
    expect(
      [...ui.querySelectorAll("[data-status]")].map((node) => node.getAttribute("data-status")),
    ).toEqual(["Partially paid", "Paid", "Unpaid", "Cancelled"]);
    expect(ui.querySelector('[data-label="Balance"]')?.textContent).toContain("300.00");
  });
  it("loads a customer folder, converts a lead and saves a note in that folder", async () => {
    api.mockResolvedValue({
      contact: { ...record, name: "Ada", kind: "lead" },
      orders: [],
      invoices: [],
      notes: [],
      balanceKobo: 5000,
    });
    const ui = await render(RecordDetail, {
      organizationId: "shop",
      section: "customers",
      record,
      canWrite: true,
      onSaved: vi.fn(),
      onClose: vi.fn(),
    });
    await click(button(ui, "Convert to customer"));
    expect(api).toHaveBeenLastCalledWith("/organizations/shop/contacts/sale/convert", {
      method: "POST",
      body: "{}",
    });
    await change(ui.querySelector('[name="note"]'), "Call on Friday");
    await submit(ui.querySelector("form"));
    expect(api).toHaveBeenLastCalledWith("/organizations/shop/contacts/sale/notes", {
      method: "POST",
      body: '{"body":"Call on Friday"}',
    });
  });
  it("includes business identity in invoice preview but hides delivery for read-only staff", async () => {
    api.mockImplementation(async (path) => (path.endsWith("/channels") ? [] : invoice));
    const ui = await render(InvoiceDetailPanel, {
      organizationId: "shop",
      invoiceId: "invoice",
      canWrite: false,
    });
    expect(ui.textContent).toContain("10 Market Road");
    expect(ui.textContent).toContain("RC123");
    expect(ui.querySelector("img")?.getAttribute("src")).toBe(invoice.businessLogo);
    expect(button(ui, "Send invoice")).toBeNull();
  });
  it("delivers an invoice only to a selected recipient and reports delivery errors", async () => {
    api.mockImplementation(async (path) => (path.endsWith("/channels") ? [] : invoice));
    const ui = await render(InvoiceDetailPanel, {
      organizationId: "shop",
      invoiceId: "invoice",
      canWrite: true,
    });
    await change(ui.querySelector('[name="email"]'), "customer@example.test");
    api.mockRejectedValueOnce(new Error("Delivery failed"));
    await submit(ui.querySelector("form"));
    expect(api).toHaveBeenLastCalledWith("/organizations/shop/invoices/invoice/send", {
      method: "POST",
      body: '{"channel":"email","email":"customer@example.test"}',
    });
    expect(ui.textContent).toContain("Delivery failed");
    expect(ui.textContent).not.toContain("Invoice delivered.");
  });
});
