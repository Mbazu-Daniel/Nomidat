import { and, eq } from "@nomidat/db";
import { createDb, type DatabaseClient } from "@nomidat/db";
import { inboundUpdate, organization } from "@nomidat/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * A channel provider delivers the same update more than once: Telegram retries,
 * WhatsApp re-sends after a timeout, a webhook is replayed by hand. Processing
 * one twice records a sale twice and answers a seller twice.
 *
 * This drives the exact claim the inbound path makes — an insert that wins only
 * for the first delivery — rather than the whole pipeline, because the claim is
 * the guard. If it stops holding, the duplicate is already committed.
 *
 * Set TEST_DATABASE_URL to a database whose name ends in `_test`.
 */
const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)("a replayed channel update", () => {
  let db: DatabaseClient;
  let orgId: string;

  beforeAll(async () => {
    if (!connectionString) return;
    if (!new URL(connectionString).pathname.endsWith("_test")) {
      throw new Error(
        `TEST_DATABASE_URL must name a database ending in "_test", got "${connectionString}".`,
      );
    }
    db = createDb(connectionString);
    const [org] = await db
      .insert(organization)
      .values({ name: "Test Trader", slug: `inbound-${crypto.randomUUID()}` })
      .returning({ id: organization.id });
    orgId = org.id;
  });

  afterAll(async () => {
    if (!connectionString) return;
    await db.delete(organization).where(eq(organization.id, orgId));
    await db.close();
  });

  /** The claim as `ConversationalService.processInbound` makes it. */
  async function claim(provider: string, rawUpdateId: string) {
    const [claimed] = await db
      .insert(inboundUpdate)
      .values({ organizationId: orgId, provider, rawUpdateId })
      .onConflictDoNothing()
      .returning();
    return claimed ?? null;
  }

  it("processesTheUpdateOnce_whenTheProviderSendsItTwice", async () => {
    const rawUpdateId = `update-${crypto.randomUUID()}`;

    expect(await claim("telegram", rawUpdateId)).not.toBeNull();
    // The retry finds the row already claimed, so it answers from the stored
    // response instead of running the business logic a second time.
    expect(await claim("telegram", rawUpdateId)).toBeNull();

    const rows = await db
      .select({ id: inboundUpdate.id })
      .from(inboundUpdate)
      .where(
        and(
          eq(inboundUpdate.organizationId, orgId),
          eq(inboundUpdate.provider, "telegram"),
          eq(inboundUpdate.rawUpdateId, rawUpdateId),
        ),
      );
    expect(rows).toHaveLength(1);
  });

  it("processesTheUpdateOnce_whenTwoDeliveriesRace", async () => {
    const rawUpdateId = `update-${crypto.randomUUID()}`;

    // A provider retry landing while the first is still being handled. The
    // unique index, not the application, has to settle this.
    const claims = await Promise.all([
      claim("whatsapp", rawUpdateId),
      claim("whatsapp", rawUpdateId),
    ]);

    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it("releasesTheClaim_whenProcessingFails", async () => {
    const rawUpdateId = `update-${crypto.randomUUID()}`;
    const first = await claim("telegram", rawUpdateId);
    if (!first) throw new Error("expected the first delivery to claim the update");

    // The path deletes the claim on failure so a corrected retry is not blocked
    // by an attempt that never finished.
    await db.delete(inboundUpdate).where(eq(inboundUpdate.id, first.id));

    expect(await claim("telegram", rawUpdateId)).not.toBeNull();
  });

  it("keepsTwoBusinessesApart_whenTheyShareAnUpdateId", async () => {
    const [rival] = await db
      .insert(organization)
      .values({ name: "Rival Shop", slug: `rival-${crypto.randomUUID()}` })
      .returning({ id: organization.id });
    // Update ids are provider-scoped, not globally unique, so the same id from
    // two businesses must be two separate updates rather than a false replay.
    const rawUpdateId = `shared-${crypto.randomUUID()}`;

    const [mine] = await db
      .insert(inboundUpdate)
      .values({ organizationId: orgId, provider: "telegram", rawUpdateId })
      .onConflictDoNothing()
      .returning();
    const [theirs] = await db
      .insert(inboundUpdate)
      .values({ organizationId: rival.id, provider: "telegram", rawUpdateId })
      .onConflictDoNothing()
      .returning();

    expect(mine).toBeDefined();
    expect(theirs).toBeDefined();

    await db.delete(organization).where(eq(organization.id, rival.id));
  });
});
