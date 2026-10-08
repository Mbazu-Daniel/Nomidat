import { eq } from "@nomidat/db";
import { createDb, type DatabaseClient } from "@nomidat/db";
import { organization, product, warehouse } from "@nomidat/db/schema";
import { StockService } from "../../src/modules/inventory/stock.service";
import { MoneyPolicyService } from "../../src/modules/money/money-policy.service";
import { WebhookDispatchService } from "../../src/modules/engagement/webhook-dispatch.service";
import { SalesPersistenceService } from "../../src/modules/sales/sales-persistence.service";
import { SalesQueriesService } from "../../src/modules/sales/sales-queries.service";
import { SalePricingService } from "../../src/modules/sales/sale-pricing.service";
import { SalesService } from "../../src/modules/sales/sales.service";

/**
 * The shared stage for the schema-invariant suites: two rival businesses, a
 * warehouse and a product, plus the services whose writes these suites drive
 * into the constraints.
 *
 * Set TEST_DATABASE_URL to a database whose name ends in `_test`; without it
 * the suites skip.
 */
export type InvariantsStage = {
  db: DatabaseClient;
  stock: StockService;
  sales: SalesService;
  orgId: string;
  rivalOrgId: string;
  warehouseId: string;
  productId: string;
  givenABusiness: (label: string) => Promise<string>;
  givenAWarehouse: (org: string) => Promise<string>;
  givenAProduct: (org: string) => Promise<string>;
  close: () => Promise<void>;
};

export async function openInvariantsStage(): Promise<InvariantsStage> {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("TEST_DATABASE_URL is not set.");
  if (!new URL(connectionString).pathname.endsWith("_test")) {
    throw new Error(
      `TEST_DATABASE_URL must name a database ending in "_test", got "${connectionString}".`,
    );
  }

  const db = createDb(connectionString);
  const stock = new StockService(db);
  const sales = new SalesService(
    db,
    new SalesQueriesService(db),
    new SalesPersistenceService(db, stock),
    new SalePricingService(db),
    new MoneyPolicyService(db),
    new WebhookDispatchService(db),
  );

  async function givenABusiness(label: string) {
    const [org] = await db
      .insert(organization)
      .values({ name: `Test ${label}`, slug: `inv-${label}-${crypto.randomUUID()}` })
      .returning({ id: organization.id });
    return org.id;
  }

  async function givenAWarehouse(org: string) {
    const [shop] = await db
      .insert(warehouse)
      .values({ organizationId: org, name: "Main", code: "MAIN", isDefault: true })
      .returning({ id: warehouse.id });
    return shop.id;
  }

  async function givenAProduct(org: string) {
    const [item] = await db
      .insert(product)
      .values({ organizationId: org, name: `Mangos-${crypto.randomUUID()}`, priceMinor: 1_000 })
      .returning({ id: product.id });
    return item.id;
  }

  const orgId = await givenABusiness("own");
  const rivalOrgId = await givenABusiness("rival");
  const warehouseId = await givenAWarehouse(orgId);
  const productId = await givenAProduct(orgId);

  return {
    db,
    stock,
    sales,
    orgId,
    rivalOrgId,
    warehouseId,
    productId,
    givenABusiness,
    givenAWarehouse,
    givenAProduct,
    async close() {
      await db.delete(organization).where(eq(organization.id, orgId));
      await db.delete(organization).where(eq(organization.id, rivalOrgId));
      await db.close();
    },
  };
}

/**
 * The constraint Postgres names when it refuses a row, or null when the row was
 * accepted. Asserting on the name rather than on "it threw" pins the test to the
 * specific constraint, so replacing it with a weaker one still fails.
 */
export async function refusedBy(run: Promise<unknown>): Promise<string | null> {
  try {
    await run;
    return null;
  } catch (error) {
    const cause = (error as { cause?: { constraint_name?: string; message?: string } }).cause;
    // A constraint violation names itself; a plain Postgres error (a numeric
    // overflow, say) has no constraint, so its own message is the evidence.
    return cause?.constraint_name ?? cause?.message ?? (error as Error).message;
  }
}
