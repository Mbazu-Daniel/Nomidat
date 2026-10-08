import { eq, sql } from "@nomidat/db";
import { purchaseOrder, stockMovement } from "@nomidat/db/schema";
import { STOCK_MOVEMENT_REFERENCE_TYPES } from "@nomidat/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openInvariantsStage, refusedBy, type InvariantsStage } from "./support/invariants-fixture";

/**
 * The invariants a database should refuse to break, whatever the code above it
 * does.
 *
 * Each one here exists because a bug that produces the bad row is invisible until
 * someone reconciles the books by hand. They are asserted as rejections rather
 * than as descriptions of current behaviour, so a constraint that is quietly
 * dropped fails this suite.
 *
 * Set TEST_DATABASE_URL to a database whose name ends in `_test`.
 */
const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)("invariants the database enforces", () => {
  let s: InvariantsStage;

  beforeAll(async () => {
    if (connectionString) s = await openInvariantsStage();
  });

  afterAll(async () => {
    await s?.close();
  });

  /**
   * Written through raw SQL rather than the Drizzle schema, on purpose.
   *
   * The point of these tests is that the *database* refuses the row. Drizzle would
   * coerce some of these values on the way in — a typed enum has no runtime check —
   * and a coercion that quietly fixes the input would hide exactly the defect
   * being guarded.
   */
  async function aRawMovement(fields: {
    type?: string;
    quantity?: string;
    previousBalance?: string;
    newBalance?: string;
    referenceType?: string;
  }) {
    return s.db.execute(sql`
      insert into stock_movement
        (id, organization_id, product_id, warehouse_id, type, quantity,
         previous_balance, new_balance, reference_type)
      values (
        gen_random_uuid(), ${s.orgId}, ${s.productId}, ${s.warehouseId},
        ${fields.type ?? "inbound_receive"},
        ${fields.quantity ?? "10"},
        ${fields.previousBalance ?? "0"},
        ${fields.newBalance ?? "10"},
        ${fields.referenceType ?? null}
      )`);
  }

  describe("the stock ledger", () => {
    it("refusesAMovementTypeItDoesNotKnow", async () => {
      // An unrecognised type is not cosmetic: StockService applies the
      // never-negative rule only to the three decreasing types, so a typo would
      // skip that check and let stock go negative while reading as a sale.
      expect(await refusedBy(aRawMovement({ type: "outbound_shipp" }))).toBe(
        "stock_movement_type_chk",
      );
    });

    it("refusesAProvenanceItDoesNotKnow", async () => {
      // The ledger cannot answer "which transfers touched this product" if a typo
      // is stored alongside the real categories.
      expect(await refusedBy(aRawMovement({ referenceType: "transfr" }))).toBe(
        "stock_movement_reference_type_chk",
      );
    });

    it("acceptsEveryProvenanceTheCodeWrites", async () => {
      // Read from the schema rather than hand-listed here. This list used to be a
      // copy in the test file, which meant a provenance added to the code left the
      // test asserting a set that was quietly incomplete — the test passed while
      // guaranteeing nothing.
      for (const referenceType of STOCK_MOVEMENT_REFERENCE_TYPES) {
        expect(await refusedBy(aRawMovement({ referenceType }))).toBeNull();
      }
    });

    it("refusesAMovementOfNothing", async () => {
      // A zero movement records no change, so it explains nothing.
      expect(
        await refusedBy(aRawMovement({ quantity: "0", previousBalance: "0", newBalance: "0" })),
      ).toBe("stock_movement_quantity_non_zero_chk");
    });

    it("refusesABalanceThatDoesNotAddUp", async () => {
      // previous 5, moved 10, so new is 15. A row claiming otherwise means one of
      // the three was computed from something other than the others.
      expect(
        await refusedBy(aRawMovement({ quantity: "10", previousBalance: "5", newBalance: "99" })),
      ).toBe("stock_movement_balance_arithmetic_chk");
    });

    it("refusesStockGoingNegative_onAShipment", async () => {
      expect(
        await refusedBy(
          aRawMovement({
            type: "outbound_ship",
            quantity: "-10",
            previousBalance: "3",
            newBalance: "-7",
          }),
        ),
      ).toBe("stock_movement_decreasing_never_negative_chk");
    });

    it("allowsANegativeMovement_whenTheBalanceStaysPositive", async () => {
      // A transfer out is a legitimate negative movement; the rule is about the
      // balance, not the sign.
      expect(
        await refusedBy(
          aRawMovement({
            type: "transfer_out",
            quantity: "-3",
            previousBalance: "10",
            newBalance: "7",
          }),
        ),
      ).toBeNull();
    });

    it("keepsTheBalanceArithmetic_true_forTheServiceItself", async () => {
      // The constraint must agree with the writer, or ordinary use would fail.
      // Read back by quantity so the assertion is about this movement rather than
      // whichever one the database happened to return first.
      const movement = await s.stock.recordMovement(s.orgId, {
        productId: s.productId,
        warehouseId: s.warehouseId,
        quantity: 25,
        type: "inbound_receive",
      });
      const [row] = await s.db
        .select({
          quantity: stockMovement.quantity,
          previousBalance: stockMovement.previousBalance,
          newBalance: stockMovement.newBalance,
        })
        .from(stockMovement)
        .where(eq(stockMovement.id, movement.id));
      expect(Number(row?.quantity)).toBe(25);
      expect(Number(row?.newBalance)).toBe(Number(row?.previousBalance) + 25);
    });
  });

  describe("a purchase order's warehouse", () => {
    async function anOrderFor(warehouse: string) {
      return s.db.insert(purchaseOrder).values({
        organizationId: s.orgId,
        reference: `PO-${crypto.randomUUID()}`,
        warehouseId: warehouse,
      });
    }

    it("acceptsTheBusinessesOwnWarehouse", async () => {
      expect(await refusedBy(anOrderFor(s.warehouseId))).toBeNull();
    });

    it("refusesAWarehouseFromAnotherBusiness", async () => {
      // Without the composite key, receiving this order would post a Stock
      // Movement into a warehouse this shop does not own — writing inventory rows
      // in a stranger's tenant. It also confirms another tenant's warehouse ids
      // cannot be probed for existence.
      const rivalWarehouse = await s.givenAWarehouse(s.rivalOrgId);
      expect(await refusedBy(anOrderFor(rivalWarehouse))).toBe(
        "purchase_order_warehouse_organization_fk",
      );
    });

    it("refusesAWarehouseThatDoesNotExist", async () => {
      expect(await refusedBy(anOrderFor(crypto.randomUUID()))).toBe(
        "purchase_order_warehouse_organization_fk",
      );
    });
  });
});
