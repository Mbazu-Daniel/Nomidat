import { eq } from "@nomidat/db";
import { orderItem, organization, product } from "@nomidat/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openSalesJourney, type SalesJourney } from "./support/sales-fixture";

/**
 * What a sale refuses to do: trust a posted price, take money it is not owed,
 * discount past zero, or sell another tenant's catalog.
 *
 * Each refusal is asserted as an error message rather than "it threw", so a
 * guard replaced by an unrelated failure still fails this suite.
 * Set TEST_DATABASE_URL to a database whose name ends in `_test`.
 */
const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)("what a sale refuses", () => {
  let j: SalesJourney;

  beforeAll(async () => {
    if (connectionString) j = await openSalesJourney();
  });

  afterAll(async () => {
    await j?.close();
  });

  it("ignoresAPostedPrice_whenTheLineNamesACataloguedProduct", async () => {
    const productId = await j.givenAProduct();
    await j.givenStockIn(productId, 10);

    const sale = await j.sales.createSale(j.orgId, null, {
      items: [{ productId, quantity: 2, unitPriceMinor: 1, lineTotalMinor: 2 } as never],
      paymentAmountMinor: 10_000,
    });

    // The catalog price wins over anything the caller posted. A sale priced by its
    // own request would let anyone buy a ₦5,000 product for one minor unit.
    expect(sale.subtotalMinor).toBe(10_000);
    const lines = await j.db
      .select({ totalMinor: orderItem.totalMinor })
      .from(orderItem)
      .where(eq(orderItem.orderId, sale.id));
    expect(lines[0]?.totalMinor).toBe(10_000);
  });

  it("refusesASale_whenThePaymentIsMoreThanTheTotal", async () => {
    const productId = await j.givenAProduct();
    await j.givenStockIn(productId, 10);

    await expect(
      j.sales.createSale(j.orgId, null, {
        items: [{ productId, quantity: 1, unitPriceMinor: 5_000 }],
        paymentAmountMinor: 9_000,
      }),
    ).rejects.toThrow("Payment cannot exceed the sale total.");
  });

  it("refusesASale_whenTheDiscountIsMoreThanTheSubtotal", async () => {
    const productId = await j.givenAProduct();
    await j.givenStockIn(productId, 10);

    // Refused rather than capped: a cap would silently sell for less than the
    // seller asked and record a discount they never agreed to.
    await expect(
      j.sales.createSale(j.orgId, null, {
        items: [{ productId, quantity: 1, unitPriceMinor: 5_000 }],
        discountMinor: 9_000,
      }),
    ).rejects.toThrow("Discount cannot exceed the subtotal.");
  });

  it("refusesASale_whenTheDiscountErasesTheWholeTotal", async () => {
    const productId = await j.givenAProduct();
    await j.givenStockIn(productId, 10);

    await expect(
      j.sales.createSale(j.orgId, null, {
        items: [{ productId, quantity: 1, unitPriceMinor: 5_000 }],
        discountMinor: 5_000,
      }),
    ).rejects.toThrow("The order total must be greater than zero.");
  });

  it("settlesTheBalance_whenPartOfAnUnpaidSaleIsPaid", async () => {
    const productId = await j.givenAProduct();
    await j.givenStockIn(productId, 20);
    const sale = await j.sales.createSale(j.orgId, null, {
      items: [{ productId, quantity: 4, unitPriceMinor: 5_000 }],
      paymentAmountMinor: 0,
    });

    const first = await j.sales.recordPayment(j.orgId, null, sale.id, { amountMinor: 10_000 });

    // 10,000 of 20,000 paid: still owing half, so still not settled.
    expect(first.status).toBe("pending");
    expect(first.paidMinor).toBe(10_000);
    expect(first.balanceMinor).toBe(10_000);

    const second = await j.sales.recordPayment(j.orgId, null, sale.id, { amountMinor: 10_000 });

    // The second payment clears the last of it, and the sale closes.
    expect(second.status).toBe("paid");
    expect(second.paidMinor).toBe(20_000);
    expect(second.balanceMinor).toBe(0);
  });

  it("refusesAPayment_whenItIsMoreThanTheOutstandingBalance", async () => {
    const productId = await j.givenAProduct();
    await j.givenStockIn(productId, 20);
    const sale = await j.sales.createSale(j.orgId, null, {
      items: [{ productId, quantity: 2, unitPriceMinor: 5_000 }],
      paymentAmountMinor: 0,
    });

    // Accepting this would credit the buyer with money they never sent.
    await expect(
      j.sales.recordPayment(j.orgId, null, sale.id, { amountMinor: 10_001 }),
    ).rejects.toThrow("Payment cannot exceed the outstanding balance.");

    const after = await j.sales.recordPayment(j.orgId, null, sale.id, { amountMinor: 10_000 });
    expect(after.paidMinor).toBe(10_000);
    expect(after.balanceMinor).toBe(0);
  });

  it("refusesToSell_whenTheProductBelongsToAnotherBusiness", async () => {
    const [rival] = await j.db
      .insert(organization)
      .values({ name: "Rival Shop", slug: `rival-${crypto.randomUUID()}` })
      .returning({ id: organization.id });
    const [foreign] = await j.db
      .insert(product)
      .values({ organizationId: rival.id, name: "Smuggled", priceMinor: 100 })
      .returning({ id: product.id });

    // Another tenant's product id must neither be sold nor priced from here.
    await expect(
      j.sales.createSale(j.orgId, null, {
        items: [{ productId: foreign.id, quantity: 1, unitPriceMinor: 1 }],
        paymentAmountMinor: 1,
      }),
    ).rejects.toThrow("Product not found.");

    await j.db.delete(organization).where(eq(organization.id, rival.id));
  });
});
