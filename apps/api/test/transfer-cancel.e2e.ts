import { HttpException } from "@nestjs/common";
import { and, eq } from "@nomidat/db";
import { createDb, type DatabaseClient } from "@nomidat/db";
import {
  organization,
  product,
  stock,
  stockMovement,
  stockTransfer,
  warehouse,
} from "@nomidat/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { StockService } from "../src/modules/inventory/stock.service";
import { TransferService } from "../src/modules/inventory/transfer.service";

/**
 * Cancelling a transfer: a draft never moved anything, an in-transit one owes
 * the source warehouse its goods, and everything past that is refused.
 *
 * Real Postgres on purpose. The shelf balance, the in-transit hold and the
 * ledger all live in SQL, so a stubbed database would pass while the books were
 * wrong. Each test gets its own product so no test can pass on stock another
 * test left behind. Set TEST_DATABASE_URL to a database whose name ends in
 * `_test`.
 */
const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)("cancelling a transfer", () => {
  let db: DatabaseClient;
  let stockService: StockService;
  let transfers: TransferService;
  let orgId: string;
  let sourceId: string;
  let destinationId: string;

  beforeAll(async () => {
    if (!connectionString) return;
    if (!new URL(connectionString).pathname.endsWith("_test")) {
      throw new Error(
        `TEST_DATABASE_URL must name a database ending in "_test", got "${connectionString}".`,
      );
    }
    db = createDb(connectionString);
    stockService = new StockService(db);
    transfers = new TransferService(db, stockService);

    const [org] = await db
      .insert(organization)
      .values({ name: "Cancel Trader", slug: `cancel-${crypto.randomUUID()}` })
      .returning({ id: organization.id });
    orgId = org.id;

    const [source] = await db
      .insert(warehouse)
      .values({ organizationId: orgId, name: "Main", code: "MAIN", isDefault: true })
      .returning({ id: warehouse.id });
    sourceId = source.id;

    const [destination] = await db
      .insert(warehouse)
      .values({ organizationId: orgId, name: "Overflow", code: "OVER" })
      .returning({ id: warehouse.id });
    destinationId = destination.id;
  });

  afterAll(async () => {
    if (!connectionString) return;
    // Everything is organization-scoped and cascades from this row.
    await db.delete(organization).where(eq(organization.id, orgId));
    await db.close();
  });

  /** A fresh product per test, so no test inherits another's stock. */
  async function givenAProduct() {
    const [item] = await db
      .insert(product)
      .values({
        organizationId: orgId,
        name: `Cocoa-${crypto.randomUUID()}`,
        priceMinor: 900,
        unit: "kg",
      })
      .returning({ id: product.id });
    return item.id;
  }

  async function givenStockIn(productId: string, quantity: number) {
    await stockService.recordMovement(orgId, {
      productId,
      warehouseId: sourceId,
      quantity,
      type: "inbound_receive",
    });
  }

  async function aTransferInDraft(productId: string, quantity: number) {
    return transfers.createTransfer(orgId, {
      fromWarehouseId: sourceId,
      toWarehouseId: destinationId,
      items: [{ productId, quantity }],
    });
  }

  async function balanceAt(productId: string, warehouseId: string) {
    const [row] = await db
      .select({ onHand: stock.onHand, inTransit: stock.inTransit })
      .from(stock)
      .where(and(eq(stock.productId, productId), eq(stock.warehouseId, warehouseId)))
      .limit(1);
    return { onHand: row?.onHand ?? 0, inTransit: row?.inTransit ?? 0 };
  }

  async function movementCount(productId: string) {
    const rows = await db
      .select({ id: stockMovement.id })
      .from(stockMovement)
      .where(eq(stockMovement.productId, productId));
    return rows.length;
  }

  /**
   * The HTTP status a caller would see, or null when the call went through.
   * These suites drive the service directly, so the exception-to-status mapping
   * is asserted here rather than over HTTP.
   */
  async function statusOf(run: Promise<unknown>): Promise<number | null> {
    try {
      await run;
      return null;
    } catch (error) {
      if (error instanceof HttpException) return error.getStatus();
      throw error;
    }
  }

  it("cancelsADraftTransfer_withoutWritingStockMovements", async () => {
    const productId = await givenAProduct();
    await givenStockIn(productId, 50);
    const transfer = await aTransferInDraft(productId, 5);
    const movementsBefore = await movementCount(productId);

    const cancelled = await transfers.cancelTransfer(orgId, null, transfer.id);

    expect(cancelled.status).toBe("cancelled");
    // Nothing had left the shelf, so nothing returns and the ledger stands.
    expect(await movementCount(productId)).toBe(movementsBefore);
    expect(await balanceAt(productId, sourceId)).toEqual({ onHand: 50, inTransit: 0 });
  });

  it("returnsTheGoodsToTheSource_whenAnInTransitTransferIsCancelled", async () => {
    const productId = await givenAProduct();
    await givenStockIn(productId, 50);
    const transfer = await aTransferInDraft(productId, 5);
    await transfers.dispatchTransfer(orgId, null, transfer.id);
    expect(await balanceAt(productId, sourceId)).toEqual({ onHand: 45, inTransit: 5 });

    const cancelled = await transfers.cancelTransfer(orgId, null, transfer.id);

    expect(cancelled.status).toBe("cancelled");
    // The shelf is back to its pre-dispatch balance and the hold is released,
    // or the goods would be stranded between the two warehouses.
    expect(await balanceAt(productId, sourceId)).toEqual({ onHand: 50, inTransit: 0 });
    // The ledger explains the return: an inbound movement against this transfer.
    const [returned] = await db
      .select({
        quantity: stockMovement.quantity,
        warehouseId: stockMovement.warehouseId,
        referenceId: stockMovement.referenceId,
      })
      .from(stockMovement)
      .where(and(eq(stockMovement.productId, productId), eq(stockMovement.type, "transfer_in")));
    expect(returned).toMatchObject({
      quantity: 5,
      warehouseId: sourceId,
      referenceId: transfer.id,
    });
  });

  it("leavesTheDestinationUntouched_whenAnInTransitTransferIsCancelled", async () => {
    const productId = await givenAProduct();
    await givenStockIn(productId, 50);
    const transfer = await aTransferInDraft(productId, 5);
    await transfers.dispatchTransfer(orgId, null, transfer.id);

    await transfers.cancelTransfer(orgId, null, transfer.id);

    // The goods never arrived, so cancelling must not book them in.
    expect(await balanceAt(productId, destinationId)).toEqual({ onHand: 0, inTransit: 0 });
  });

  it("refusesToCancel_whenTheGoodsWereAlreadyReceived", async () => {
    const productId = await givenAProduct();
    await givenStockIn(productId, 50);
    const transfer = await aTransferInDraft(productId, 5);
    await transfers.dispatchTransfer(orgId, null, transfer.id);
    await transfers.receiveTransfer(orgId, null, transfer.id);

    expect(await statusOf(transfers.cancelTransfer(orgId, null, transfer.id))).toBe(409);
    // The stock stays where receiving put it.
    expect(await balanceAt(productId, destinationId)).toEqual({ onHand: 5, inTransit: 0 });
    expect(await balanceAt(productId, sourceId)).toEqual({ onHand: 45, inTransit: 0 });
  });

  it("refusesToCancel_whenTheTransferIsAlreadyCancelled", async () => {
    const productId = await givenAProduct();
    await givenStockIn(productId, 50);
    const transfer = await aTransferInDraft(productId, 5);
    await transfers.cancelTransfer(orgId, null, transfer.id);

    expect(await statusOf(transfers.cancelTransfer(orgId, null, transfer.id))).toBe(409);
    expect(await movementCount(productId)).toBe(1);
  });

  it("hidesTheTransfer_whenAnotherBusinessTriesToCancel", async () => {
    const productId = await givenAProduct();
    await givenStockIn(productId, 50);
    const transfer = await aTransferInDraft(productId, 5);
    const [rival] = await db
      .insert(organization)
      .values({ name: "Rival Trader", slug: `rival-cancel-${crypto.randomUUID()}` })
      .returning({ id: organization.id });

    expect(await statusOf(transfers.cancelTransfer(rival.id, null, transfer.id))).toBe(404);

    // Our transfer is untouched: the id did not leak another tenant's row.
    const [still] = await db
      .select({ status: stockTransfer.status })
      .from(stockTransfer)
      .where(eq(stockTransfer.id, transfer.id));
    expect(still.status).toBe("draft");

    await db.delete(organization).where(eq(organization.id, rival.id));
  });
});
