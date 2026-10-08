import { and, eq } from "@nomidat/db";
import { createDb, type DatabaseClient } from "@nomidat/db";
import { invoice, invoiceItem, invoiceNegotiation, organization } from "@nomidat/db/schema";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InvoiceNegotiationService } from "../src/modules/invoices/invoice-negotiation.service";
import type { AuditService } from "../src/modules/audit/audit.service";

/**
 * An offer is a stranger with a link asking for a lower price. The link is the
 * only credential, so what is defended here is that a stranger cannot move money
 * and cannot flood the seller's inbox: the invoice total changes only when the
 * seller accepts, and one live proposal per invoice is a database invariant
 * rather than a check two callers can both pass.
 *
 * Set TEST_DATABASE_URL to a database whose name ends in `_test`.
 */
const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)("a counter-offer on a shared invoice", () => {
  let db: DatabaseClient;
  let negotiations: InvoiceNegotiationService;
  let orgId: string;
  let shareCode: string;
  let invoiceId: string;

  /** Audit writes are not what is under test; recording them is a side effect. */
  const audit = { record: async () => undefined } as unknown as AuditService;

  beforeAll(async () => {
    if (!connectionString) return;
    if (!new URL(connectionString).pathname.endsWith("_test")) {
      throw new Error(
        `TEST_DATABASE_URL must name a database ending in "_test", got "${connectionString}".`,
      );
    }
    db = createDb(connectionString);
    negotiations = new InvoiceNegotiationService(db, audit);

    const [org] = await db
      .insert(organization)
      .values({ name: "Test Trader", slug: `offer-${crypto.randomUUID()}` })
      .returning({ id: organization.id });
    orgId = org.id;

    shareCode = crypto.randomUUID();
    const [created] = await db
      .insert(invoice)
      .values({
        organizationId: orgId,
        invoiceNumber: "INV-0001",
        subtotalMinor: 100_000,
        totalMinor: 100_000,
        currency: "NGN",
        status: "sent",
        shareCode,
        shareEnabled: true,
      })
      .returning({ id: invoice.id });
    invoiceId = created.id;
    await db.insert(invoiceItem).values({
      invoiceId,
      description: "Mangos",
      quantity: 1,
      unitPriceMinor: 100_000,
      totalMinor: 100_000,
    });
  });

  afterAll(async () => {
    if (!connectionString) return;
    await db.delete(organization).where(eq(organization.id, orgId));
    await db.close();
  });

  async function currentTotal() {
    const [row] = await db
      .select({ totalMinor: invoice.totalMinor })
      .from(invoice)
      .where(eq(invoice.id, invoiceId));
    return row?.totalMinor ?? 0;
  }

  it("recordsTheOfferWithoutTouchingTheTotal", async () => {
    const offer = await negotiations.propose(shareCode, { proposedTotalMinor: 80_000 });

    expect(offer.proposedTotalMinor).toBe(80_000);
    expect(offer.status).toBe("pending");
    // The customer still owes what the invoice said.
    expect(await currentTotal()).toBe(100_000);
  });

  it("refusesASecondOffer_whileOneIsAwaitingAResponse", async () => {
    // The unique index is the guard: two callers can both pass a read-then-write
    // check, and only one of them can hold the pending slot.
    const second = await db
      .insert(invoiceNegotiation)
      .values({ organizationId: orgId, invoiceId, proposedTotalMinor: 70_000 })
      .onConflictDoNothing()
      .returning();

    expect(second).toHaveLength(0);
    await expect(negotiations.propose(shareCode, { proposedTotalMinor: 60_000 })).rejects.toThrow(
      ConflictException,
    );
  });

  it("refusesAnOfferThatIsNotBelowTheTotal", async () => {
    await expect(negotiations.propose(shareCode, { proposedTotalMinor: 100_000 })).rejects.toThrow(
      "An offer must be lower than the invoice total.",
    );
    await expect(negotiations.propose(shareCode, { proposedTotalMinor: 500_000 })).rejects.toThrow(
      "An offer must be lower than the invoice total.",
    );
  });

  it("refusesAnAmountThatIsNotAPrice", async () => {
    await expect(negotiations.propose(shareCode, { proposedTotalMinor: 0 })).rejects.toThrow(
      "Enter an amount greater than zero.",
    );
    await expect(negotiations.propose(shareCode, { proposedTotalMinor: -5_000 })).rejects.toThrow(
      "Enter an amount greater than zero.",
    );
  });

  it("givesTheSameAnswerForAnUnknownLink_asForARevokedOne", async () => {
    // Otherwise the error distinguishes a wrong code from a disabled one, which
    // is a way to enumerate live share links.
    await expect(
      negotiations.propose("00000000-0000-0000-0000-000000000000", { proposedTotalMinor: 1_000 }),
    ).rejects.toThrow("This invoice link is invalid or has been revoked.");

    await db.update(invoice).set({ shareEnabled: false }).where(eq(invoice.id, invoiceId));
    await expect(negotiations.propose(shareCode, { proposedTotalMinor: 1_000 })).rejects.toThrow(
      "This invoice link is invalid or has been revoked.",
    );
    await db.update(invoice).set({ shareEnabled: true }).where(eq(invoice.id, invoiceId));
  });

  it("movesTheTotalOnly_whenTheSellerAccepts", async () => {
    const [offer] = await db
      .select({ id: invoiceNegotiation.id })
      .from(invoiceNegotiation)
      .where(
        and(eq(invoiceNegotiation.invoiceId, invoiceId), eq(invoiceNegotiation.status, "pending")),
      )
      .limit(1);
    if (!offer) throw new Error("expected a pending offer to decide");

    const decision = await negotiations.decide(orgId, offer.id, "accepted", { userId: null });

    expect(decision.status).toBe("accepted");
    // Now, and only now, the balance moves.
    expect(await currentTotal()).toBe(80_000);
  });

  it("refusesToDecideAnOfferTwice", async () => {
    const [offer] = await db
      .select({ id: invoiceNegotiation.id })
      .from(invoiceNegotiation)
      .where(eq(invoiceNegotiation.invoiceId, invoiceId))
      .limit(1);
    if (!offer) throw new Error("expected the decided offer to still exist");

    // It is still there, but no longer pending, so the replay is refused rather
    // than moving the total a second time.
    await expect(
      negotiations.decide(orgId, offer.id, "accepted", { userId: null }),
    ).rejects.toThrow("This offer has already been decided.");
    expect(await currentTotal()).toBe(80_000);
  });

  it("keepsTwoBusinessesOffersApart", async () => {
    const [rival] = await db
      .insert(organization)
      .values({ name: "Rival Shop", slug: `offer-${crypto.randomUUID()}` })
      .returning({ id: organization.id });

    // An id from one business must not decide an offer belonging to another.
    await expect(
      negotiations.decide(rival.id, crypto.randomUUID(), "accepted", { userId: null }),
    ).rejects.toThrow(NotFoundException);

    await db.delete(organization).where(eq(organization.id, rival.id));
  });
});
