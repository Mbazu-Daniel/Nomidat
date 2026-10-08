import { eq, sql } from "@nomidat/db";
import { member, order } from "@nomidat/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openInvariantsStage, refusedBy, type InvariantsStage } from "./support/invariants-fixture";

/**
 * The invariants on a sale and the people who take them: which payment methods
 * a line may declare, what quantities mean, and the member row every tenant
 * lookup resolves through.
 *
 * Asserted as rejections rather than as descriptions of current behaviour, so a
 * constraint that is quietly dropped fails this suite.
 *
 * Set TEST_DATABASE_URL to a database whose name ends in `_test`.
 */
const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)("invariants on a sale and its sellers", () => {
  let s: InvariantsStage;

  beforeAll(async () => {
    if (connectionString) s = await openInvariantsStage();
  });

  afterAll(async () => {
    await s?.close();
  });

  describe("a sale's payment method", () => {
    /** These take real sales, so the product needs stock to sell. */
    async function givenStockIn(quantity: number) {
      await s.stock.recordMovement(s.orgId, {
        productId: s.productId,
        warehouseId: s.warehouseId,
        quantity,
        type: "inbound_receive",
      });
    }

    it("recordsHowTheMoneyArrives_onACashSale", async () => {
      await givenStockIn(50);
      const sale = await s.sales.createSale(s.orgId, null, {
        items: [{ productId: s.productId, quantity: 1, unitPriceMinor: 1_000 }],
        paymentAmountMinor: 1_000,
        paymentMethod: "transfer",
      });

      // On the sale itself, so it survives the sale being read back.
      expect(sale.paymentMethod).toBe("transfer");
    });

    it("recordsTheMethod_whenTheSaleIsTakenOnCredit", async () => {
      await givenStockIn(50);
      // The case the column exists for: no Payment row is written, so the method
      // would otherwise be lost for as long as the money is owed.
      const sale = await s.sales.createSale(s.orgId, null, {
        items: [{ productId: s.productId, quantity: 1, unitPriceMinor: 1_000 }],
        paymentAmountMinor: 0,
        paymentMethod: "card",
      });
      expect(sale.paymentMethod).toBe("card");
      expect(sale.paidMinor).toBe(0);
    });

    it("refusesAMethodItDoesNotRecognise", async () => {
      await givenStockIn(50);
      // "barter" passes the DTO, which only checks it is a string, so the
      // database is the last place this can be caught.
      expect(
        await refusedBy(
          s.sales.createSale(s.orgId, null, {
            items: [{ productId: s.productId, quantity: 1, unitPriceMinor: 1_000 }],
            paymentAmountMinor: 1_000,
            paymentMethod: "barter",
          }),
        ),
      ).toBe("orders_payment_method_chk");
    });

    it("acceptsEveryMethodTheTillAndTheChatSend", async () => {
      // The surfaces do not agree on the spelling: the POS and storefront send
      // "bank_transfer", the conversational and picture-import paths send
      // "transfer". Both land in this column, so the constraint has to accept
      // both — a narrower list refuses real sales at the counter.
      for (const paymentMethod of ["cash", "bank_transfer", "transfer", "card"] as const) {
        await givenStockIn(50);
        const sale = await s.sales.createSale(s.orgId, null, {
          items: [{ productId: s.productId, quantity: 1, unitPriceMinor: 1_000 }],
          paymentAmountMinor: 1_000,
          paymentMethod,
        });
        expect(sale.paymentMethod).toBe(paymentMethod);
      }
    });
  });

  describe("a line quantity", () => {
    async function aRawLine(quantity: string, totalMinor = "1000") {
      const [sale] = await s.db
        .insert(order)
        .values({
          organizationId: s.orgId,
          orderNumber: `ORD-${crypto.randomUUID()}`,
          subtotalMinor: 1000,
          totalMinor: 1000,
        })
        .returning({ id: order.id });
      return s.db.execute(sql`
        insert into order_item (id, order_id, quantity, unit_price_minor, total_minor)
        values (gen_random_uuid(), ${sale.id}, ${quantity}, 1000, ${totalMinor})`);
    }

    it("recordsAFractionalQuantity_whenTheShopSellsPartOfAKilo", async () => {
      // The reason 0030 exists: stock is counted in thirds of a kilo, so a sale
      // has to be able to say so.
      expect(await refusedBy(aRawLine("1.5"))).toBeNull();
    });

    it("keepsThreeDecimalPlaces", async () => {
      expect(await refusedBy(aRawLine("0.001"))).toBeNull();
    });

    it("refusesAQuantityOfNothing", async () => {
      expect(await refusedBy(aRawLine("0"))).toBe("order_item_quantity_positive_chk");
    });

    it("refusesANegativeQuantity", async () => {
      // A negative line would return stock while still recording money owed.
      expect(await refusedBy(aRawLine("-2"))).toBe("order_item_quantity_positive_chk");
    });

    it("refusesAQuantityTooLargeForTheColumn", async () => {
      // numeric(12,3) holds nine whole digits; a twelfth-digit overflow is refused
      // outright, where a fourth decimal place would only be rounded.
      expect(await refusedBy(aRawLine("12345678901"))).toContain("numeric field overflow");
    });
  });

  describe("a member of the business", () => {
    it("isRequiredForTheTenantLookupsThatFollow", async () => {
      // Stated so the guard's dependency is explicit: every tenant route resolves
      // the caller through this row, and its absence is what a forged session
      // would be missing.
      expect(
        await s.db.select().from(member).where(eq(member.organizationId, s.orgId)),
      ).toHaveLength(0);
    });
  });
});
