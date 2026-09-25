// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { api, render, change, click, button, submit } from "./render";
import { RecordsPanel } from "../records-panel";
import { WorkspacePage } from "../workspace-page";
import { OverviewPanel } from "../overview-panel";
import { CreateBusiness } from "../create-business";
import { ProductEditor } from "../product-editor";
import { ExpenseEditor } from "../expense-editor";
import { SaleReceipt } from "../sale-receipt";
const product = {
  id: "rice",
  name: "Rice",
  createdAt: "2026-09-24",
  stockQuantity: 2,
  lowStockThreshold: 5,
  unit: "bags",
  priceKobo: 12000,
};
describe("workspace pages", () => {
  it("searches and filters the current inventory page without allowing read-only writes", async () => {
    api.mockResolvedValue([
      product,
      { ...product, id: "cement", name: "Cement", stockQuantity: 20 },
    ]);
    const ui = await render(RecordsPanel, {
      organizationId: "shop",
      section: "inventory",
      canWrite: false,
    });
    expect(button(ui, "Add product")).toBeNull();
    await change(ui.querySelector('[aria-label="Filter records"]'), "low");
    expect(ui.querySelector("tbody")?.textContent).toContain("Rice");
    expect(ui.querySelector("tbody")?.textContent).not.toContain("Cement");
    await change(ui.querySelector('[aria-label="Search inventory"]'), "missing");
    expect(ui.textContent).toContain("No matching records");
  });
  it("opens a record and closes it without losing the list", async () => {
    api.mockResolvedValue([product]);
    const ui = await render(RecordsPanel, {
      organizationId: "shop",
      section: "inventory",
      canWrite: true,
    });
    await click(button(ui, "Rice"));
    expect(ui.querySelector('[name="price"]')).not.toBeNull();
    await click(button(ui, "Close"));
    expect(ui.querySelector('[name="price"]')).toBeNull();
    expect(ui.querySelector("tbody")?.textContent).toContain("Rice");
  });
  it("selects a saved business and keeps Settings last in the sidebar", async () => {
    sessionStorage.setItem("nomidat.organization", "second");
    api.mockImplementation(async (path) =>
      path === "/organizations"
        ? [
            { id: "first", name: "First" },
            { id: "second", name: "Second" },
          ]
        : path.endsWith("/access")
          ? { role: "staff" }
          : [],
    );
    const ui = await render(WorkspacePage, { section: "inventory" });
    expect(ui.querySelector<HTMLSelectElement>('[aria-label="Selected business"]')?.value).toBe(
      "second",
    );
    expect(ui.querySelector("nav")?.lastElementChild?.textContent).toContain("Settings");
    expect(api).toHaveBeenCalledWith("/organizations/second/access");
    await change(ui.querySelector('[aria-label="Selected business"]'), "__create__");
    expect(ui.textContent).toContain("Make it your business");
    expect(ui.querySelector("tbody")).toBeNull();
  });
  it("shows overview totals from the selected business", async () => {
    api.mockResolvedValue({
      salesTotalKobo: 120000,
      outstandingCreditKobo: 20000,
      expensesTotalKobo: 10000,
      customerCount: 1,
      productCount: 4,
      lowStockCount: 2,
    });
    const ui = await render(OverviewPanel, { organizationId: "shop" });
    expect(api).toHaveBeenCalledWith("/organizations/shop/summary");
    expect(ui.textContent).toContain("1,200");
    expect(ui.textContent).toContain("2 need a restock");
  });
  it("creates a business with trimmed shop details and omits optional empty fields", async () => {
    const created = vi.fn();
    api.mockResolvedValue({ id: "shop", name: "Ada shop" });
    const ui = await render(CreateBusiness, { onCreated: created });
    await change(ui.querySelector('[name="name"]'), " Ada shop ");
    await change(ui.querySelector('[name="phone"]'), "+2348012345678");
    await change(ui.querySelector('[name="ownerName"]'), "Ada");
    await change(ui.querySelector('[name="address"]'), "10 Market Road");
    await submit(ui.querySelector("form"));
    const call = api.mock.calls.find(
      ([path, init]) => path === "/organizations" && init?.method === "POST",
    )!;
    expect(JSON.parse(String(call[1]?.body))).toEqual({
      name: "Ada shop",
      slug: "ada-shop",
      businessDetails: { ownerName: "Ada", phone: "+2348012345678", address: "10 Market Road" },
    });
    expect(created).toHaveBeenCalledWith({ id: "shop", name: "Ada shop" });
  });
  it("keeps product edits separate from stock adjustments", async () => {
    const save = vi.fn();
    const ui = await render(ProductEditor, { record: product, busy: false, save });
    await change(ui.querySelector('[name="price"]'), "150.25");
    await submit(ui.querySelector("form"));
    expect(save).toHaveBeenCalledWith(
      "/products/rice",
      expect.objectContaining({ priceKobo: 15025 }),
      "PATCH",
    );
    expect(save.mock.calls[0][1]).not.toHaveProperty("stockQuantity");
    await click(button(ui, "Archive product"));
    expect(save).toHaveBeenLastCalledWith("/products/rice", { isActive: false }, "PATCH");
  });
  it("updates an expense in kobo and reports a failed save", async () => {
    api.mockImplementation(async (path) =>
      path.endsWith("/expense-categories")
        ? []
        : {
            id: "expense",
            description: "Fuel",
            amountKobo: 10000,
            spentAt: "2026-09-24T11:00:00Z",
            paymentMethod: "cash",
            categoryId: null,
          },
    );
    const ui = await render(ExpenseEditor, {
      path: "/organizations/shop",
      expenseId: "expense",
      onSaved: vi.fn(),
    });
    await change(ui.querySelector('[name="amount"]'), "150.50");
    api.mockRejectedValueOnce(new Error("Save unavailable"));
    await submit(ui.querySelector("form"));
    expect(JSON.parse(String(api.mock.calls.at(-1)?.[1]?.body)).amountKobo).toBe(15050);
    expect(ui.textContent).toContain("Save unavailable");
  });
  it("prints the paid amount, outstanding balance and payment references on a receipt", async () => {
    api.mockImplementation(async (path) =>
      path.endsWith("/receipt")
        ? {
            receiptNumber: "R-1",
            sale: { ...product, totalKobo: 20000, currency: "NGN" },
            items: [],
            paidKobo: 5000,
            balanceKobo: 15000,
            payments: [
              {
                id: "payment",
                amountKobo: 5000,
                method: "transfer",
                paidAt: "2026-09-24",
                reference: "BANK-123",
              },
            ],
          }
        : { name: "Ada shop" },
    );
    const ui = await render(SaleReceipt, { organizationId: "shop", saleId: "sale" });
    expect(ui.textContent).toContain("BANK-123");
    expect(ui.textContent).toContain("NGN 150.00");
    expect(button(ui, "Print / save PDF")).not.toBeNull();
  });
});
