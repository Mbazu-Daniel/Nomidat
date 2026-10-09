import { and, eq } from "@nomidat/db";
import { createDb, type DatabaseClient } from "@nomidat/db";
import { order, organization, product, stockMovement, warehouse } from "@nomidat/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { StockService } from "../src/modules/inventory/stock.service";
import { MoneyPolicyService } from "../src/modules/money/money-policy.service";
import { WebhookDispatchService } from "../src/modules/engagement/webhook-dispatch.service";
import { SalesPersistenceService } from "../src/modules/sales/sales-persistence.service";
import { SalesQueriesService } from "../src/modules/sales/sales-queries.service";
import { SalePricingService } from "../src/modules/sales/sale-pricing.service";
import { SalesService } from "../src/modules/sales/sales.service";
import { POS_PAYMENT_METHODS } from "../src/modules/pos/types/pos.type";

/**
 * The counter sale path, exercised the way the till calls it.
 *
 * This exists because the POS is the one caller whose vocabulary differs from the
 * rest of the app: it sends `bank_transfer` where the chat assistant sends
 * `transfer`. A constraint added on `orders.payment_method` accepted only the
 * latter, so every bank-transfer sale at the counter was refused — a guard
 * against bad data that broke the common path instead. These tests drive the POS
 * values in, so that class of mismatch fails here rather than in a shop.
 *
 * Set TEST_DATABASE_URL to a database whose name ends in `_test`.
 */
const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)("a counter sale", () => {
  let db: DatabaseClient;
  let sales: SalesService;
  let stock: StockService;
  let orgId: string;
  let warehouseId: string;
  let productId: string;

  beforeAll(async () => {
    if (!connectionString) return;
    if (!new URL(connectionString).pathname.endsWith("_test")) {
      throw new Error(
        `TEST_DATABASE_URL must name a database ending in "_test", got "${connectionString}".`,
      );
    }
    db = createDb(connectionString);
    stock = new StockService(db);
    sales = new SalesService(
      db,
      new SalesQueriesService(db),
      new SalesPersistenceService(db, stock),
      new SalePricingService(db),
      new MoneyPolicyService(db),
      new WebhookDispatchService(db),
    );

    const [org] = await db
      .insert(organization)
      .values({ name: "Test Trader", slug: `pos-${crypto.randomUUID()}` })
      .returning({ id: organization.id });
    orgId = org.id;
    const [shop] = await db
      .insert(warehouse)
      .values({ organizationId: orgId, name: "Main", code: "MAIN", isDefault: true })
      .returning({ id: warehouse.id });
    warehouseId = shop.id;
    const [item] = await db
      .insert(product)
      .values({
        organizationId: orgId,
        name: `Mangos-${crypto.randomUUID()}`,
        priceMinor: 5_000,
        unit: "kg",
      })
      .returning({ id: product.id });
    productId = item.id;
  });

  afterAll(async () => {
    if (!connectionString) return;
    await db.delete(organization).where(eq(organization.id, orgId));
    await db.close();
  });

  async function givenStockIn(quantity: number) {
    await stock.recordMovement(orgId, {
      productId,
      warehouseId,
      quantity,
      type: "inbound_receive",
    });
  }

  it("recordsACashSale_whenTheTenderIsEnough", async () => {
    await givenStockIn(100);

    // Mirrors PosService.recordSale: cash settles at the counter, so the whole
    // total is tendered and the sale closes immediately.
    const sale = await sales.createSale(orgId, null, {
      source: "pos",
      items: [{ productId, quantity: 2, unitPriceMinor: 5_000 }],
      paymentAmountMinor: 10_000,
      paymentMethod: POS_PAYMENT_METHODS.CASH,
    });

    expect(sale.status).toBe("paid");
    expect(sale.balanceMinor).toBe(0);
    expect(sale.paymentMethod).toBe("cash");
  });

  it("recordsABankTransfer_whenTheTillSelectsOne", async () => {
    await givenStockIn(100);

    // The value the POS actually sends. It reached orders.payment_method as
    // "bank_transfer" and was refused by a check that only allowed "transfer".
    const sale = await sales.createSale(orgId, null, {
      source: "pos",
      items: [{ productId, quantity: 1, unitPriceMinor: 5_000 }],
      // A transfer settles through a provider, so nothing is tendered at the
      // counter and the sale stays open.
      paymentAmountMinor: 0,
      paymentMethod: POS_PAYMENT_METHODS.BANK_TRANSFER,
    });

    expect(sale.paymentMethod).toBe("bank_transfer");
    expect(sale.status).toBe("pending");
  });

  it("recordsACardSale_whenTheTillSelectsOne", async () => {
    await givenStockIn(100);

    const sale = await sales.createSale(orgId, null, {
      source: "pos",
      items: [{ productId, quantity: 1, unitPriceMinor: 5_000 }],
      paymentAmountMinor: 0,
      paymentMethod: POS_PAYMENT_METHODS.CARD,
    });

    expect(sale.paymentMethod).toBe("card");
  });

  it("neverStoresAFractionalMinorUnit_whenAWeighedLineLandsBetweenTwo", async () => {
    // 5 grams at ₦1.00 per gram is half a kobo. Sumin unrounded and the order
    // total reaches the table as 0.5, where the whole-minor CHECK refuses it —
    // a sale that fails at the till with a constraint error nobody can act on.
    const perGram = await givenProductWith(10);
    await db.update(product).set({ priceMinor: 100 }).where(eq(product.id, perGram));

    const sale = await sales.createSale(orgId, null, {
      source: "pos",
      items: [{ productId: perGram, quantity: 0.005 }],
      paymentAmountMinor: 1,
      paymentMethod: POS_PAYMENT_METHODS.CASH,
    });

    expect(Number.isInteger(sale.totalMinor)).toBe(true);
    expect(sale.totalMinor).toBe(1);
  });

  it("acceptsEveryMethodTheTillOffers", async () => {
    // Driven off the POS's own list, so adding a method to the till without
    // teaching the database about it fails here.
    for (const method of Object.values(POS_PAYMENT_METHODS)) {
      await givenStockIn(10);
      const sale = await sales.createSale(orgId, null, {
        source: "pos",
        items: [{ productId, quantity: 1, unitPriceMinor: 5_000 }],
        paymentAmountMinor: 5_000,
        paymentMethod: method,
      });
      expect(sale.paymentMethod).toBe(method);
    }
  });

  it("acceptsTheAssistantsSpellingOfABankTransfer_too", async () => {
    // The chat assistant and picture import say "transfer"; the till says
    // "bank_transfer". Both are real writes to this column.
    await givenStockIn(100);

    const sale = await sales.createSale(orgId, null, {
      source: "manual",
      items: [{ productId, quantity: 1, unitPriceMinor: 5_000 }],
      paymentAmountMinor: 0,
      paymentMethod: "transfer",
    });

    expect(sale.paymentMethod).toBe("transfer");
  });

  /** A fresh product holding exactly `quantity`, so tests cannot pool stock. */
  async function givenProductWith(quantity: number) {
    const [item] = await db
      .insert(product)
      .values({
        organizationId: orgId,
        name: `Mangos-${crypto.randomUUID()}`,
        priceMinor: 5_000,
        unit: "kg",
      })
      .returning({ id: product.id });
    await stock.recordMovement(orgId, {
      productId: item.id,
      warehouseId,
      quantity,
      type: "inbound_receive",
    });
    return item.id;
  }

  it("roundsTheTotalPerLine_whenAWeighedLineLandsBetweenTwoMinorUnits", async () => {
    // 5 grams at ₦1.00 per gram is half a kobo. This goes through the money seam
    // — the authority the till's own preview must match — rather than
    // SalesService directly, because rounding once at the end would let the
    // cashier be quoted 0.5 and the books record 1.
    const perGram = await givenProductWith(10);
    await db.update(product).set({ priceMinor: 100 }).where(eq(product.id, perGram));

    const totals = await new MoneyPolicyService(db).orderTotals(
      orgId,
      [{ quantity: 0.005, unitPriceMinor: 100 }],
      0,
    );

    expect(totals.subtotalMinor).toBe(1);
    expect(Number.isInteger(totals.subtotalMinor)).toBe(true);
  });

  it("sellsAFractionalQuantity_whenTheShopWeighsTheGoods", async () => {
    // The POS increments in whole steps, but a weighed line is the reason
    // quantity became decimal: 1.5 kg at ₦5,000/kg is ₦7,500.
    const weighed = await givenProductWith(20);

    const sale = await sales.createSale(orgId, null, {
      source: "pos",
      items: [{ productId: weighed, quantity: 1.5 }],
      paymentAmountMinor: 7_500,
      paymentMethod: POS_PAYMENT_METHODS.CASH,
    });

    expect(sale.totalMinor).toBe(7_500);
    expect(sale.balanceMinor).toBe(0);

    // The stock ledger records the same fraction, so the two never disagree.
    const [movement] = await db
      .select({ quantity: stockMovement.quantity })
      .from(stockMovement)
      .where(and(eq(stockMovement.productId, weighed), eq(stockMovement.type, "outbound_ship")));
    expect(Number(movement?.quantity)).toBeCloseTo(-1.5, 3);
  });

  it("leavesNoOrder_whenTheTillCannotFillTheBasket", async () => {
    const scarce = await givenProductWith(1);
    const before = await db
      .select({ id: order.id })
      .from(order)
      .where(eq(order.organizationId, orgId));

    await expect(
      sales.createSale(orgId, null, {
        source: "pos",
        items: [{ productId: scarce, quantity: 5, unitPriceMinor: 5_000 }],
        paymentAmountMinor: 25_000,
        paymentMethod: POS_PAYMENT_METHODS.CASH,
      }),
    ).rejects.toThrow("Not enough stock");

    // An abandoned basket must leave nothing behind for the books to show.
    const after = await db
      .select({ id: order.id })
      .from(order)
      .where(eq(order.organizationId, orgId));
    expect(after).toHaveLength(before.length);
  });
});
