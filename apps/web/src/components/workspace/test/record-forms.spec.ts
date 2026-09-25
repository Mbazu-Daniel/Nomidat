// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { api, render, change, submit, click, button } from "./render";
import { RecordForm } from "../record-form";
import { TransactionForm } from "../transaction-form";
import { InventoryPictureReview } from "../inventory-picture-review";
const base = { organizationId: "shop", onSaved: vi.fn(), onCancel: vi.fn() };
describe("reviewed records", () => {
  it("saves product money in kobo and preserves zero stock", async () => {
    api.mockResolvedValue({});
    const ui = await render(RecordForm, {
      ...base,
      section: "inventory",
      pictureItems: [{ name: "Cement", unit: "bags", quantity: 0, unitPriceNaira: 12.5 }],
    });
    await submit(ui.querySelector("form"));
    expect(api).toHaveBeenCalledWith(
      "/organizations/shop/products",
      expect.objectContaining({
        body: JSON.stringify({
          name: "Cement",
          costKobo: 0,
          unit: "bags",
          stockQuantity: 0,
          lowStockThreshold: 5,
          priceKobo: 1250,
        }),
        method: "POST",
      }),
    );
  });
  it("matches an extracted expense category and retains its date and method", async () => {
    api.mockResolvedValue([{ id: "transport", name: "Transport" }]);
    const ui = await render(RecordForm, {
      ...base,
      section: "expenses",
      expenseDraft: {
        description: "Taxi",
        amountNaira: 12.5,
        date: "2026-09-24",
        category: "transport",
        paymentMethod: "transfer",
      },
    });
    await submit(ui.querySelector("form"));
    const body = JSON.parse(String(api.mock.calls.at(-1)?.[1]?.body));
    expect(body).toEqual({
      description: "Taxi",
      amountKobo: 1250,
      categoryId: "transport",
      spentAt: "2026-09-24T11:00:00.000Z",
      paymentMethod: "transfer",
    });
  });
  it("keeps form values and presents a failed save without reporting success", async () => {
    api.mockRejectedValue(new Error("Service unavailable"));
    const saved = vi.fn();
    const ui = await render(RecordForm, { ...base, onSaved: saved, section: "customers" });
    await change(ui.querySelector('[name="name"]'), "Ada");
    await submit(ui.querySelector("form"));
    expect(ui.querySelector('[role="alert"]')?.textContent).toContain("Service unavailable");
    expect(saved).not.toHaveBeenCalled();
    expect(ui.querySelector<HTMLInputElement>('[name="name"]')?.value).toBe("Ada");
  });
  it("blocks a payment greater than the sale total", async () => {
    api.mockResolvedValue([]);
    const ui = await render(TransactionForm, {
      ...base,
      section: "sales",
      pictureItems: [{ name: "Rice", quantity: 2, unitPriceNaira: 100, unit: "bags" }],
    });
    await change(ui.querySelector('[name="paid"]'), "201");
    await submit(ui.querySelector("form"));
    expect(ui.textContent).toContain("Payment cannot exceed the total");
    expect(api.mock.calls.every((call) => !call[1])).toBe(true);
  });
  it("requires missing extracted amounts instead of silently inventing zero", async () => {
    api.mockResolvedValue([]);
    const ui = await render(TransactionForm, {
      ...base,
      section: "invoices",
      pictureItems: [{ name: "Rice", quantity: null, unitPriceNaira: null, unit: null }],
      invoiceDraft: {
        customerName: "Ada",
        dueDate: null,
        taxNaira: null,
        discountNaira: null,
        totalNaira: null,
        notes: null,
      },
    });
    await submit(ui.querySelector("form"));
    expect(ui.querySelector('[role="alert"]')).not.toBeNull();
    expect(api.mock.calls.every((call) => !call[1])).toBe(true);
  });
  it("skips a picture item without adding inventory", async () => {
    api.mockResolvedValue([]);
    const saved = vi.fn();
    const ui = await render(InventoryPictureReview, {
      ...base,
      onSaved: saved,
      section: "inventory",
      items: [{ name: "Rice", quantity: 2, unitPriceNaira: 100, unit: "bags" }],
    });
    await click(button(ui, "Skip item"));
    expect(saved).toHaveBeenCalledOnce();
    expect(api.mock.calls.every((call) => !call[1])).toBe(true);
  });
});
