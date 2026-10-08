import { describe, expect, it } from "vitest";
import { StockService } from "../stock.service";
import { createDbStub } from "../../../common/db/test/db.stub";

/**
 * Feeds the stub: the product+warehouse lookup, then the current on-hand balance.
 * Inserts queue two rows — the stock upsert (ignored) and the movement ledger row.
 */
function ledgerStub(onHand: number) {
  return createDbStub(
    [[{ productId: "p1", warehouseId: "w1" }], [{ onHand }]],
    [[{ onHand: onHand }], [{ id: "m1", previousBalance: onHand }]],
  );
}

describe("stock movement ledger", () => {
  it("records the balance before and after so the history is explainable", async () => {
    const { db, inserts } = ledgerStub(10);
    const service = new StockService(db);

    await service.recordMovement("shop", {
      productId: "p1",
      warehouseId: "w1",
      quantity: -3,
      type: "outbound_ship",
      referenceId: "order-1",
    });

    // The second insert is the ledger row; it must carry both balances.
    expect(inserts.mock.calls[1][0]).toMatchObject({
      previousBalance: 10,
      newBalance: 7,
      quantity: -3,
      type: "outbound_ship",
      referenceId: "order-1",
    });
  });

  it("refuses to ship more than is on hand", async () => {
    const { db, inserts } = ledgerStub(2);
    const service = new StockService(db);

    await expect(
      service.recordMovement("shop", {
        productId: "p1",
        warehouseId: "w1",
        quantity: -5,
        type: "outbound_ship",
      }),
    ).rejects.toThrow(/Not enough stock/);
    // Nothing may be written when the movement is rejected.
    expect(inserts).not.toHaveBeenCalled();
  });

  it("refuses a zero movement, which would be a meaningless ledger row", async () => {
    const { db } = ledgerStub(10);
    const service = new StockService(db);

    await expect(
      service.recordMovement("shop", {
        productId: "p1",
        warehouseId: "w1",
        quantity: 0,
        type: "adjustment_add",
      }),
    ).rejects.toThrow(/cannot be zero/);
  });

  it("lets a return push stock back above the original level", async () => {
    const { db, inserts } = ledgerStub(0);
    const service = new StockService(db);

    await service.recordMovement("shop", {
      productId: "p1",
      warehouseId: "w1",
      quantity: 4,
      type: "return_in",
    });

    expect(inserts.mock.calls[1][0]).toMatchObject({
      previousBalance: 0,
      newBalance: 4,
      type: "return_in",
    });
  });

  it("writes the new balance onto the stock level as well as the ledger", async () => {
    const { db, inserts } = ledgerStub(10);
    const service = new StockService(db);

    await service.recordMovement("shop", {
      productId: "p1",
      warehouseId: "w1",
      quantity: 5,
      type: "inbound_receive",
    });

    expect(inserts.mock.calls[0][0]).toMatchObject({
      productId: "p1",
      warehouseId: "w1",
      onHand: 15,
    });
  });

  it("reports zero on hand for a product that has never been stocked", async () => {
    const { db } = createDbStub([[]]);
    const service = new StockService(db);

    expect(await service.onHandAt(db, "shop", "p1", "w1")).toBe(0);
  });
});
