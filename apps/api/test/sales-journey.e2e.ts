import { and, eq } from "@nomidat/db";
import {
  order,
  organization,
  payment,
  product,
  stockMovement,
  warehouse,
} from "@nomidat/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openSalesJourney, type SalesJourney } from "./support/sales-fixture";

/**
 * The journey a seller's first day takes: stock in, goods out, money recorded,
 * and an offline till replaying the same sale without charging twice.
 *
 * Each test gets its own product so no test can pass on stock another test left
 * behind. Set TEST_DATABASE_URL to a database whose name ends in `_test`.
 */
const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)("taking a sale", () => {
  let j: SalesJourney;

  beforeAll(async () => {
    if (connectionString) j = await openSalesJourney();
  });

  afterAll(async () => {
    await j?.close();
  });

  it("recordsTheSaleThePaymentAndTheStockMovement_whenTheTillSells", async () => {
    const productId = await j.givenAProduct();
    await j.givenStockIn(productId, 100);

    const sale = await j.sales.createSale(j.orgId, null, {
      items: [{ productId, quantity: 3, unitPriceMinor: 5_000 }],
      paymentAmountMinor: 15_000,
      paymentMethod: "cash",
      source: "pos",
    });

    expect(sale.totalMinor).toBe(15_000);
    expect(sale.status).toBe("paid");
    expect(sale.balanceMinor).toBe(0);

    // Stock fell by exactly what was sold.
    expect(await j.onHand(productId)).toBe(97);

    // And the ledger explains why, carrying the balance either side of the move.
    const [movement] = await j.db
      .select({
        quantity: stockMovement.quantity,
        previousBalance: stockMovement.previousBalance,
        newBalance: stockMovement.newBalance,
        referenceType: stockMovement.referenceType,
      })
      .from(stockMovement)
      .where(and(eq(stockMovement.productId, productId), eq(stockMovement.type, "outbound_ship")));
    expect(movement).toMatchObject({
      quantity: -3,
      previousBalance: 100,
      newBalance: 97,
      referenceType: "order",
    });

    const [paid] = await j.db
      .select({ amountMinor: payment.amountMinor, method: payment.method })
      .from(payment)
      .where(eq(payment.orderId, sale.id));
    expect(paid.amountMinor).toBe(15_000);
    expect(paid.method).toBe("cash");
  });

  it("leavesTheBusinessWhole_whenTheWarehouseCannotCoverTheSale", async () => {
    const productId = await j.givenAProduct();
    await j.givenStockIn(productId, 5);
    const movementsBefore = (await j.movementCount(productId)).length;

    await expect(
      j.sales.createSale(j.orgId, null, {
        items: [{ productId, quantity: 9, unitPriceMinor: 5_000 }],
        paymentAmountMinor: 45_000,
      }),
    ).rejects.toThrow("Not enough stock");

    // A refused sale must leave no order, no payment and no phantom movement:
    // the seller is owed nothing and holds nothing extra.
    const orders = await j.db
      .select({ id: order.id })
      .from(order)
      .where(and(eq(order.organizationId, j.orgId), eq(order.totalMinor, 45_000)));
    expect(orders).toHaveLength(0);
    expect(await j.onHand(productId)).toBe(5);
    expect(await j.movementCount(productId)).toHaveLength(movementsBefore);
  });

  it("owesNothing_whenASaleIsTakenOnCredit", async () => {
    const productId = await j.givenAProduct();
    await j.givenStockIn(productId, 20);

    const sale = await j.sales.createSale(j.orgId, null, {
      items: [{ productId, quantity: 2, unitPriceMinor: 5_000 }],
      paymentAmountMinor: 0,
    });

    // No money arrived, so nothing is marked paid and the balance is owed.
    expect(sale.status).toBe("pending");
    expect(sale.paidMinor).toBe(0);
    expect(sale.balanceMinor).toBe(10_000);

    const payments = await j.db
      .select({ id: payment.id })
      .from(payment)
      .where(eq(payment.orderId, sale.id));
    expect(payments).toHaveLength(0);
  });

  it("returnsTheOriginalSale_whenAnOfflineTillReplaysTheSameReference", async () => {
    const productId = await j.givenAProduct();
    await j.givenStockIn(productId, 50);
    const clientReference = `pos-${crypto.randomUUID()}`;
    const input = {
      items: [{ productId, quantity: 4, unitPriceMinor: 5_000 }],
      paymentAmountMinor: 20_000,
      source: "pos" as const,
      clientReference,
    };

    const first = await j.sales.createSale(j.orgId, null, input);
    const stockAfterFirst = await j.onHand(productId);
    const movementsAfterFirst = (await j.movementCount(productId)).length;

    // The till retried after a dead connection. Same key, so the customer is
    // charged once and the stock moves once.
    const replayed = await j.sales.createSale(j.orgId, null, input);

    expect(replayed.id).toBe(first.id);
    expect(await j.onHand(productId)).toBe(stockAfterFirst);
    expect(await j.movementCount(productId)).toHaveLength(movementsAfterFirst);

    const orders = await j.db
      .select({ id: order.id })
      .from(order)
      .where(and(eq(order.organizationId, j.orgId), eq(order.clientReference, clientReference)));
    expect(orders).toHaveLength(1);

    const payments = await j.db
      .select({ id: payment.id })
      .from(payment)
      .where(eq(payment.orderId, first.id));
    expect(payments).toHaveLength(1);
  });

  it("chargesTheTaxRate_whenACallerPostsNoTaxAtAll", async () => {
    // Its own business, so the tax rate it sets cannot leak into the other journeys.
    const trader = await j.givenABusinessTaxingAt(750);
    const [vatProduct] = await j.db
      .insert(product)
      .values({ organizationId: trader, name: "Battery", priceMinor: 5_000 })
      .returning({ id: product.id });
    const [vatWarehouse] = await j.db
      .select({ id: warehouse.id })
      .from(warehouse)
      .where(eq(warehouse.organizationId, trader));
    await j.stockService.recordMovement(trader, {
      productId: vatProduct.id,
      warehouseId: vatWarehouse.id,
      quantity: 10,
      type: "inbound_receive",
    });

    const sale = await j.sales.createSale(trader, null, {
      items: [{ productId: vatProduct.id, quantity: 1 }],
      paymentAmountMinor: 5_375,
    });

    // There is no taxMinor field on the sale DTO at all. A business trading at 7.5%
    // is charged 7.5%, whether the caller remembered to ask or not - a caller that
    // could post a tax figure could sell tax free.
    expect(sale.taxMinor).toBe(375);
    expect(sale.totalMinor).toBe(5_375);

    await j.db.delete(organization).where(eq(organization.id, trader));
  });
});
