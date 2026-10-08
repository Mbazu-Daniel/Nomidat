import { eq } from "@nomidat/db";
import { createDb, type DatabaseClient } from "@nomidat/db";
import { organization, product, stock, stockMovement, warehouse } from "@nomidat/db/schema";
import { StockService } from "../../src/modules/inventory/stock.service";
import { MoneyPolicyService } from "../../src/modules/money/money-policy.service";
import { WebhookDispatchService } from "../../src/modules/engagement/webhook-dispatch.service";
import { SalesPersistenceService } from "../../src/modules/sales/sales-persistence.service";
import { SalesQueriesService } from "../../src/modules/sales/sales-queries.service";
import { SalePricingService } from "../../src/modules/sales/sale-pricing.service";
import { SalesService } from "../../src/modules/sales/sales.service";

/**
 * The shared stage for the sales journeys: a business, its default warehouse,
 * and the services wired the way the app wires them.
 *
 * Real Postgres on purpose. Every assertion in these suites is a fact that
 * lives in SQL — a transaction boundary, a unique index, a ledger row — so a
 * stubbed database would pass while the books were wrong.
 *
 * Set TEST_DATABASE_URL to a database whose name ends in `_test`; without it
 * the suites skip. The name check runs here so no suite can quietly write to
 * development data.
 */
export type SalesJourney = {
  db: DatabaseClient;
  sales: SalesService;
  stockService: StockService;
  orgId: string;
  warehouseId: string;
  /** A fresh product per test, so no test inherits another's stock. */
  givenAProduct: () => Promise<string>;
  givenStockIn: (productId: string, quantity: number) => Promise<void>;
  /** A business of its own, for a journey that must not disturb the shared org. */
  givenABusinessTaxingAt: (taxRateBps: number) => Promise<string>;
  onHand: (productId: string) => Promise<number>;
  movementCount: (productId: string) => Promise<Array<{ id: string }>>;
  close: () => Promise<void>;
};

export async function openSalesJourney(): Promise<SalesJourney> {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("TEST_DATABASE_URL is not set.");
  if (!new URL(connectionString).pathname.endsWith("_test")) {
    throw new Error(
      `TEST_DATABASE_URL must name a database ending in "_test", got "${connectionString}".`,
    );
  }

  const db = createDb(connectionString);
  const stockService = new StockService(db);
  const sales = new SalesService(
    db,
    new SalesQueriesService(db),
    new SalesPersistenceService(db, stockService),
    new SalePricingService(db),
    new MoneyPolicyService(db),
    new WebhookDispatchService(db),
  );

  const [org] = await db
    .insert(organization)
    .values({ name: "Test Trader", slug: `sale-${crypto.randomUUID()}` })
    .returning({ id: organization.id });
  const orgId = org.id;

  // A sale resolves a default warehouse; without one it is refused outright.
  const [shop] = await db
    .insert(warehouse)
    .values({ organizationId: orgId, name: "Main", code: "MAIN", isDefault: true })
    .returning({ id: warehouse.id });
  const warehouseId = shop.id;

  async function givenAProduct() {
    const [item] = await db
      .insert(product)
      .values({
        organizationId: orgId,
        name: `Mangos-${crypto.randomUUID()}`,
        priceMinor: 5_000,
        unit: "kg",
      })
      .returning({ id: product.id });
    return item.id;
  }

  async function givenStockIn(productId: string, quantity: number) {
    // No referenceType: stock simply arrived, with no order or transfer behind it.
    await stockService.recordMovement(orgId, {
      productId,
      warehouseId,
      quantity,
      type: "inbound_receive",
    });
  }

  async function givenABusinessTaxingAt(taxRateBps: number) {
    const [trader] = await db
      .insert(organization)
      .values({ name: "VAT Trader", slug: `vat-${crypto.randomUUID()}`, taxRateBps })
      .returning({ id: organization.id });
    await db
      .insert(warehouse)
      .values({ organizationId: trader.id, name: "Main", code: "MAIN", isDefault: true });
    return trader.id;
  }

  async function onHand(productId: string) {
    const [row] = await db
      .select({ onHand: stock.onHand })
      .from(stock)
      .where(eq(stock.productId, productId));
    return row?.onHand ?? 0;
  }

  async function movementCount(productId: string) {
    return db
      .select({ id: stockMovement.id })
      .from(stockMovement)
      .where(eq(stockMovement.productId, productId));
  }

  return {
    db,
    sales,
    stockService,
    orgId,
    warehouseId,
    givenAProduct,
    givenStockIn,
    givenABusinessTaxingAt,
    onHand,
    movementCount,
    async close() {
      // Everything is organization-scoped and cascades from this row.
      await db.delete(organization).where(eq(organization.id, orgId));
      await db.close();
    },
  };
}
