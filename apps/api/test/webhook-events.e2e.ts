import { eq } from "@nomidat/db";
import { createDb, type DatabaseClient } from "@nomidat/db";
import {
  notification,
  organization,
  outboundWebhook,
  product,
  warehouse,
} from "@nomidat/db/schema";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { EngagementService } from "../src/modules/engagement/engagement.service";
import { StockService } from "../src/modules/inventory/stock.service";
import { MoneyPolicyService } from "../src/modules/money/money-policy.service";
import { WebhookDispatchService } from "../src/modules/engagement/webhook-dispatch.service";
import { InvoicesService } from "../src/modules/invoices/invoices.service";
import { SalesPersistenceService } from "../src/modules/sales/sales-persistence.service";
import { SalesQueriesService } from "../src/modules/sales/sales-queries.service";
import { SalePricingService } from "../src/modules/sales/sale-pricing.service";
import { SalesService } from "../src/modules/sales/sales.service";

/**
 * Whether the events this product advertises are actually emitted, and to whom.
 *
 * The subscription, the row it reads and the signature of what goes out are all
 * real; only the socket is stubbed, because a receiver that has to be listening
 * would make the suite depend on the network rather than on this code.
 *
 * Set TEST_DATABASE_URL to a database whose name ends in `_test`.
 */
const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)("webhook events", () => {
  let db: DatabaseClient;
  let engagement: EngagementService;
  let invoices: InvoicesService;
  let sales: SalesService;
  let stockService: StockService;
  let orgId: string;
  let warehouseId: string;
  let receiver: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    if (!connectionString) return;
    if (!new URL(connectionString).pathname.endsWith("_test")) {
      throw new Error(
        `TEST_DATABASE_URL must name a database ending in "_test", got "${connectionString}".`,
      );
    }
    db = createDb(connectionString);
    engagement = new EngagementService(db);
    invoices = new InvoicesService(db, new MoneyPolicyService(db), new WebhookDispatchService(db));
    stockService = new StockService(db);
    sales = new SalesService(
      db,
      new SalesQueriesService(db),
      new SalesPersistenceService(db, stockService),
      new SalePricingService(db),
      new MoneyPolicyService(db),
      new WebhookDispatchService(db),
    );
    orgId = await givenABusiness();

    // A sale resolves a default warehouse; without one it is refused outright.
    const [shop] = await db
      .insert(warehouse)
      .values({ organizationId: orgId, name: "Main", code: "MAIN", isDefault: true })
      .returning({ id: warehouse.id });
    warehouseId = shop.id;

    receiver = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(null, { status: 200 }),
    );
    vi.stubGlobal("fetch", receiver);
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    if (!connectionString) return;
    await db.delete(outboundWebhook).where(eq(outboundWebhook.organizationId, orgId));
    await db.delete(notification).where(eq(notification.organizationId, orgId));
    await db.delete(organization).where(eq(organization.id, orgId));
    await db.close();
  });

  async function givenABusiness() {
    const [row] = await db
      .insert(organization)
      .values({ name: "Webhook Test", slug: `hooks-${crypto.randomUUID()}` })
      .returning({ id: organization.id });
    return row.id;
  }

  /** Two subscriptions that deliberately ask for different events. */
  async function givenSubscriptions() {
    const listening = await engagement.createWebhook(orgId, {
      url: "https://hooks.example.test/invoices",
      events: ["invoice.created", "payment.received"],
    });
    const silent = await engagement.createWebhook(orgId, {
      url: "https://hooks.example.test/sales",
      events: ["sale.created"],
    });
    return { listening, silent };
  }

  async function deliveries() {
    return receiver.mock.calls.map(([url, init]) => ({
      url: String(url),
      body: JSON.parse(String(init?.body)) as {
        event: string;
        organizationId: string;
        data: Record<string, unknown>;
      },
    }));
  }

  /** The delivery is written back to the subscription after the POST returns. */
  async function settled(subscriptionId: string) {
    await vi.waitFor(
      async () => {
        const [row] = await db
          .select({ lastDeliveryAt: outboundWebhook.lastDeliveryAt })
          .from(outboundWebhook)
          .where(eq(outboundWebhook.id, subscriptionId))
          .limit(1);
        expect(row?.lastDeliveryAt).not.toBeNull();
      },
      { timeout: 3_000 },
    );
  }

  it("announcesANewInvoiceOnlyToTheSubscribersThatAskedForIt", async () => {
    const { listening, silent } = await givenSubscriptions();

    const created = await invoices.createInvoice(orgId, {
      items: [{ description: "Fitting", quantity: 1, unitPriceMinor: 4_500 }],
    });
    await settled(listening.id);

    const sent = await deliveries();
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe("https://hooks.example.test/invoices");
    expect(sent[0].body.event).toBe("invoice.created");
    expect(sent[0].body.organizationId).toBe(orgId);
    expect(sent[0].body.data.invoiceNumber).toBe(created.invoiceNumber);
    expect(sent[0].body.data.currency).toBe(created.currency);
    expect(sent[0].body.data.totalMinor).toBe(created.totalMinor);

    // The subscription that only wanted sales must hear nothing, or a tenant's
    // receiver would be woken by events it never signed up for.
    const [untouched] = await db
      .select({ lastDeliveryAt: outboundWebhook.lastDeliveryAt })
      .from(outboundWebhook)
      .where(eq(outboundWebhook.id, silent.id));
    expect(untouched.lastDeliveryAt).toBeNull();
  });

  it("announcesEveryInvoice_notJustTheFirst", async () => {
    const before = (await deliveries()).length;

    await invoices.createInvoice(orgId, {
      items: [{ description: "Survey", quantity: 2, unitPriceMinor: 1_000 }],
    });
    await vi.waitFor(() => expect(receiver.mock.calls.length).toBeGreaterThan(before));

    expect((await deliveries()).length).toBe(before + 1);
  });

  it("announcesANewSale_toTheSubscriptionThatAskedForSales", async () => {
    const before = receiver.mock.calls.length;
    const [item] = await db
      .insert(product)
      .values({ organizationId: orgId, name: `Mangos-${crypto.randomUUID()}`, priceMinor: 5_000 })
      .returning({ id: product.id });
    await stockService.recordMovement(orgId, {
      productId: item.id,
      warehouseId,
      quantity: 10,
      type: "inbound_receive",
    });

    await sales.createSale(orgId, null, {
      items: [{ productId: item.id, quantity: 2, unitPriceMinor: 5_000 }],
    });

    await vi.waitFor(() => expect(receiver.mock.calls.length).toBeGreaterThan(before));
    const [sent] = (await deliveries()).slice(before);
    expect(sent.url).toBe("https://hooks.example.test/sales");
    expect(sent.body.event).toBe("sale.created");
    expect(sent.body.organizationId).toBe(orgId);
    expect(sent.body.data.currency).toBe("NGN");
    expect(sent.body.data.totalMinor).toBe(10_000);
  });

  it("refusesToOfferAnEventThatIsNeverEmitted", async () => {
    // A subscription to an event with no producer is a promise that can never be
    // kept, so the API drops it at the door rather than storing it.
    const created = await engagement
      .createWebhook(orgId, {
        url: "https://hooks.example.test/never",
        events: ["invoice.paid", "sale.created"],
      })
      .catch(() => null);

    expect(created).not.toBeNull();
    expect(created?.events).toBe("sale.created");
  });

  describe("an in-app notice", () => {
    it("givesEachOwnerTheirOwnRow_andRedeliveryChangesNothing", async () => {
      const first = crypto.randomUUID();
      const second = crypto.randomUUID();
      const entry = { title: "Payment received", body: "NGN 4,500.00", dedupeKey: "payment:abc" };

      await engagement.notifyOwners(orgId, [first, second], entry);
      await engagement.notifyOwners(orgId, [first, second], entry);

      const rows = await db
        .select({ userId: notification.userId, title: notification.title })
        .from(notification)
        .where(eq(notification.organizationId, orgId));

      expect(rows).toHaveLength(2);
      expect(new Set(rows.map((row) => row.userId))).toEqual(new Set([first, second]));
      expect(rows[0].title).toBe("Payment received");
    });
  });
});
