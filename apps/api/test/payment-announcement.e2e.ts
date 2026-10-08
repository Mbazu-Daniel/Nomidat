import { eq, inArray } from "@nomidat/db";
import { createDb, type DatabaseClient } from "@nomidat/db";
import {
  member,
  notification,
  organization,
  outboundWebhook,
  paymentLink,
  user,
} from "@nomidat/db/schema";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { parseApiEnv } from "../src/common/config/env";
import { EngagementService } from "../src/modules/engagement/engagement.service";
import { WebhookDispatchService } from "../src/modules/engagement/webhook-dispatch.service";
import { PaymentNotificationService } from "../src/modules/payments/payment-notification.service";
import { TelegramClient } from "../src/modules/telegram/telegram.client";
import { WhatsAppClient } from "../src/modules/whatsapp/whatsapp.client";

/**
 * What happens the moment money actually lands.
 *
 * A paid link has to reach every owner who should know — in the app, and at any
 * endpoint they have subscribed — exactly once, however many times the payment
 * provider retries its callback. The retry is the part worth guarding: a shop
 * that gets told five times stops reading the inbox at all.
 *
 * The channel clients are constructed but never called: none of these owners
 * has linked Telegram or WhatsApp, which is the ordinary case for an inbox
 * notice.
 *
 * Set TEST_DATABASE_URL to a database whose name ends in `_test`.
 */
const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)("a payment landing", () => {
  let db: DatabaseClient;
  let engagement: EngagementService;
  let announcements: PaymentNotificationService;
  let orgId: string;
  let ownerId: string;
  let coOwner: string;
  let reference: string;
  let sender: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    if (!connectionString) return;
    if (!new URL(connectionString).pathname.endsWith("_test")) {
      throw new Error(
        `TEST_DATABASE_URL must name a database ending in "_test", got "${connectionString}".`,
      );
    }
    db = createDb(connectionString);
    engagement = new EngagementService(db);
    const webhooks = new WebhookDispatchService(db);
    // Parsed from an explicit object rather than from the environment: these two
    // are the only fields the schema demands, so the suite decides its own
    // configuration instead of inheriting whatever the machine running it has.
    const env = parseApiEnv({
      DATABASE_URL: connectionString,
      BETTER_AUTH_SECRET: "insecure-test-secret-0123456789abcdef",
    });
    announcements = new PaymentNotificationService(
      db,
      new TelegramClient(env),
      new WhatsAppClient(env),
      engagement,
      webhooks,
    );

    const [org] = await db
      .insert(organization)
      .values({ name: "Paid Shop", slug: `paid-${crypto.randomUUID()}` })
      .returning({ id: organization.id });
    orgId = org.id;
    ownerId = await givenAOwner(`${crypto.randomUUID()}@example.test`);
    coOwner = await givenAOwner(`${crypto.randomUUID()}@example.test`);

    sender = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", sender);
    await engagement.createWebhook(orgId, {
      url: "https://hooks.example.test/payments",
      events: ["payment.received"],
    });

    reference = `ref-${crypto.randomUUID()}`;
    await db.insert(paymentLink).values({
      organizationId: orgId,
      amountMinor: 45_000,
      reference,
      status: "paid",
    });
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    if (!connectionString) return;
    await db.delete(notification).where(eq(notification.organizationId, orgId));
    await db.delete(outboundWebhook).where(eq(outboundWebhook.organizationId, orgId));
    await db.delete(paymentLink).where(eq(paymentLink.organizationId, orgId));
    await db.delete(member).where(eq(member.organizationId, orgId));
    await db.delete(user).where(inArray(user.id, [ownerId, coOwner]));
    await db.delete(organization).where(eq(organization.id, orgId));
    await db.close();
  });

  async function givenAOwner(email: string) {
    const [account] = await db
      .insert(user)
      .values({ name: "Owner", email })
      .returning({ id: user.id });
    await db.insert(member).values({ organizationId: orgId, userId: account.id, role: "owner" });
    return account.id;
  }

  function deliveries() {
    return sender.mock.calls.map(
      ([, init]) =>
        JSON.parse(String(init?.body)) as {
          event: string;
          data: Record<string, unknown>;
        },
    );
  }

  it("tellsBothOwnersAndTheSubscribedEndpoint", async () => {
    await announcements.createNotification(reference);

    const sent = deliveries();
    expect(sent).toHaveLength(1);
    expect(sent[0].event).toBe("payment.received");
    expect(sent[0].data.paymentLinkReference).toBe(reference);
    expect(sent[0].data.amountMinor).toBe(45_000);
    expect(sent[0].data.currency).toBe("NGN");

    const rows = await db
      .select({ userId: notification.userId, title: notification.title })
      .from(notification)
      .where(eq(notification.organizationId, orgId));
    expect(rows.map((row) => row.userId).sort()).toEqual([ownerId, coOwner].sort());
    expect(rows.every((row) => row.title === "Payment received")).toBe(true);
  });

  it("saysItOnce_howeverOftenTheProviderRetries", async () => {
    // The latch is taken under a row lock inside the same transaction as the
    // notices, so two callbacks arriving together cannot both read "not told yet".
    await announcements.createNotification(reference);
    await announcements.createNotification(reference);

    const rows = await db.select().from(notification).where(eq(notification.organizationId, orgId));
    expect(rows).toHaveLength(2);
    // This test starts with a cleared call log, so anything here would be a
    // second announcement of a payment the owners were already told about.
    expect(sender.mock.calls).toHaveLength(0);
  });

  it("saysNothingForALinkThatHasNotBeenPaid", async () => {
    const pending = `ref-${crypto.randomUUID()}`;
    await db.insert(paymentLink).values({
      organizationId: orgId,
      amountMinor: 1_000,
      reference: pending,
      status: "pending",
    });

    await announcements.createNotification(pending);
    await announcements.createNotification(pending);

    expect(sender.mock.calls).toHaveLength(0);
    const rows = await db.select().from(notification).where(eq(notification.organizationId, orgId));
    expect(rows).toHaveLength(2);
  });
});
