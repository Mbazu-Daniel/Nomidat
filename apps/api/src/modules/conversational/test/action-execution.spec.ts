import { describe, it, expect, vi } from "vitest";
import { createDbStub } from "../../../common/db/test/db.stub";
import { ActionsService } from "../actions.service";
import { PictureActionsService } from "../picture-actions.service";
import { ExtendedActionsService } from "../extended-actions.service";
import { getActionReview, getMissingActionDetails } from "../action-review";
import type { InventoryService } from "../../inventory/inventory.service";
import type { SalesService } from "../../sales/sales.service";
import type { ContactsService } from "../../contacts/contacts.service";
import type { InvoicesService } from "../../invoices/invoices.service";
import type { ReportsService } from "../../reports/reports.service";
import type { PaystackService } from "../../payments/providers/paystack/paystack.service";
import type { InvoiceDeliveryService } from "../../invoices/invoice-delivery.service";

describe("review and execution", () => {
  it("distinguishes new inventory from restocking and accepts explicit zero values", () => {
    const action = {
      intent: "create_product" as const,
      productName: "Rice",
      stockQuantity: 0,
      unitPriceNaira: 0,
    };
    expect(getMissingActionDetails(action)).toBeNull();
    expect(getActionReview(action)).toContain("does not restock");
    expect(getMissingActionDetails({ ...action, unitPriceNaira: undefined })).toContain(
      "selling price",
    );
  });
  it("reviews custom sale lines as unpaid without claiming stock was deducted", () => {
    const review = getActionReview({
      intent: "record_sale",
      items: [{ description: "Rice", quantity: 2, unitPriceNaira: 100 }],
    });
    expect(review).toContain("2 × Rice");
    expect(review).toContain("Unpaid, no payment recorded");
    expect(review).toContain("stock is not deducted");
    expect(
      getActionReview({
        intent: "record_sale",
        productName: "Rice",
        quantity: 1,
        amountNaira: 100,
        paid: true,
      }),
    ).toContain("paid");
  });
  it("requires an identified contact before notes and invoice creation", () => {
    expect(getMissingActionDetails({ intent: "add_note", description: "Call Friday" })).toContain(
      "Which contact",
    );
    expect(getMissingActionDetails({ intent: "add_note", customerName: "Ada" })).toContain(
      "note say",
    );
    expect(getMissingActionDetails({ intent: "create_invoice", customerName: "Ada" })).toContain(
      "invoice items",
    );
    expect(
      getActionReview({
        intent: "create_invoice",
        customerName: "Ada",
        date: "2026-09-25",
        items: [{ description: "Rice", quantity: 1, unitPriceNaira: 100 }],
      }),
    ).toContain("Due 2026-09-25");
    expect(
      getActionReview({
        intent: "record_expense",
        amountNaira: 100,
        description: "Fuel",
        date: "2026-09-25",
      }),
    ).toContain("Fuel");
  });
  it("creates only a new product and preserves zero stock", async () => {
    const createProduct = vi
      .fn()
      .mockResolvedValue({ name: "Rice", stockQuantity: 0, unit: "bags" });
    const service = new PictureActionsService(
      { createProduct } as unknown as InventoryService,
      {} as SalesService,
    );
    await service.execute(
      {
        intent: "create_product",
        productName: "Rice",
        stockQuantity: 0,
        unitPriceNaira: 12.5,
        unit: "bags",
      },
      "shop",
      "user",
    );
    expect(createProduct).toHaveBeenCalledWith("shop", {
      name: "Rice",
      stockQuantity: 0,
      priceKobo: 1250,
      unit: "bags",
    });
    await expect(service.execute({ intent: "create_product" }, "shop", "user")).rejects.toThrow(
      "incomplete",
    );
  });
  it("saves reviewed lines with tax and discount and never invents a stock product ID", async () => {
    const createSale = vi.fn().mockResolvedValue({ totalKobo: 19500, balanceKobo: 0 });
    const service = new PictureActionsService(
      {} as InventoryService,
      { createSale } as unknown as SalesService,
    );
    await service.execute(
      {
        intent: "record_sale",
        items: [{ description: "Rice", quantity: 2, unitPriceNaira: 100 }],
        taxNaira: 5,
        discountNaira: 10,
        paid: true,
      },
      "shop",
      "user",
    );
    const body = createSale.mock.calls[0][2];
    expect(body.paymentAmountKobo).toBe(19500);
    expect(body.items[0]).not.toHaveProperty("productId");
    await expect(
      service.execute({ intent: "record_sale", customerName: "Ada", items: [] }, "shop", "user"),
    ).rejects.toThrow("customer ID");
  });
  it("retains exact line totals when a sale price cannot be divided evenly", async () => {
    const { db } = createDbStub([[{ id: "rice", name: "Rice" }]]);
    const createSale = vi.fn().mockResolvedValue({ id: "order12345678", balanceKobo: 100 });
    const service = new ActionsService(
      db,
      { createSale } as unknown as SalesService,
      {} as ExtendedActionsService,
      {} as PictureActionsService,
    );
    await service.executeAction(
      { intent: "record_sale", productName: "Rice", quantity: 3, amountNaira: 1 },
      "shop",
      "user",
    );
    expect(createSale.mock.calls[0][2].items[0]).toMatchObject({
      unitPriceKobo: 33,
      lineTotalKobo: 100,
      quantity: 3,
    });
    expect(createSale.mock.calls[0][2].paymentAmountKobo).toBe(0);
  });
  it("records expense money in kobo using the matched category", async () => {
    const { db, inserts } = createDbStub(
      [[{ id: "fuel", name: "Fuel" }]],
      [[{ amountKobo: 1250 }]],
    );
    const service = new ActionsService(
      db,
      {} as SalesService,
      {} as ExtendedActionsService,
      {} as PictureActionsService,
    );
    await service.executeAction(
      {
        intent: "record_expense",
        amountNaira: 12.5,
        category: "FUEL",
        description: "Petrol",
        paymentMethod: "transfer",
      },
      "shop",
      "user",
    );
    expect(inserts).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: "shop",
        categoryId: "fuel",
        amountKobo: 1250,
        paymentMethod: "transfer",
      }),
    );
  });
  it("validates invoice and payment-link inputs before calling external services", async () => {
    const { db } = createDbStub();
    const initializePayment = vi
      .fn()
      .mockResolvedValue({ authorizationUrl: "https://paystack.test/pay" });
    const service = new ExtendedActionsService(
      db,
      {} as ContactsService,
      {} as InvoicesService,
      {} as ReportsService,
      { initializePayment } as unknown as PaystackService,
      {} as InvoiceDeliveryService,
    );
    expect(
      await service.executeAction({ intent: "create_payment_link" }, "shop", "user"),
    ).toContain("sale ID");
    expect(initializePayment).not.toHaveBeenCalled();
    expect(
      await service.executeAction(
        { intent: "create_payment_link", orderId: "sale", email: "ada@example.test" },
        "shop",
        "user",
      ),
    ).toContain("https://paystack.test/pay");
    expect(initializePayment).toHaveBeenCalledWith("shop", {
      orderId: "sale",
      email: "ada@example.test",
    });
  });
});

it("asks for incomplete sale details before any write can be proposed", () => {
  expect(getMissingActionDetails({ intent: "record_sale" })).toBeTruthy();
  expect(
    getMissingActionDetails({ intent: "record_sale", productName: "Rice", quantity: 1 }),
  ).toBeTruthy();
  expect(
    getMissingActionDetails({
      intent: "record_sale",
      productName: "Rice",
      quantity: 1,
      amountNaira: 100,
    }),
  ).toBeNull();
});
