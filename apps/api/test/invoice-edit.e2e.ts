import { eq } from "@nomidat/db";
import { createDb, type DatabaseClient } from "@nomidat/db";
import { invoice, invoiceItem, organization } from "@nomidat/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MoneyPolicyService } from "../src/modules/money/money-policy.service";
import { WebhookDispatchService } from "../src/modules/engagement/webhook-dispatch.service";
import { InvoicesService } from "../src/modules/invoices/invoices.service";

/**
 * Correcting an invoice after it has been raised, and the one rule that decides
 * when that stops being possible.
 *
 * Real Postgres on purpose. The guard is a row lock taken inside the same
 * transaction as the write, and a lock that only exists on a mocked connection
 * would pass here while the live one never took.
 *
 * Set TEST_DATABASE_URL to a database whose name ends in `_test`.
 */
const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)("editing an invoice", () => {
  let db: DatabaseClient;
  let invoices: InvoicesService;
  let orgId: string;
  let rivalOrgId: string;

  const lines = (priceMinor: number) => [
    { description: "Repair labour", quantity: 1, unitPriceMinor: priceMinor },
  ];

  beforeAll(async () => {
    if (!connectionString) return;
    if (!new URL(connectionString).pathname.endsWith("_test")) {
      throw new Error(
        `TEST_DATABASE_URL must name a database ending in "_test", got "${connectionString}".`,
      );
    }
    db = createDb(connectionString);
    invoices = new InvoicesService(db, new MoneyPolicyService(db), new WebhookDispatchService(db));
    orgId = await givenABusiness("own");
    rivalOrgId = await givenABusiness("rival");
  });

  afterAll(async () => {
    if (!connectionString) return;
    await db.delete(organization).where(eq(organization.id, orgId));
    await db.delete(organization).where(eq(organization.id, rivalOrgId));
    await db.close();
  });

  async function givenABusiness(label: string) {
    const [row] = await db
      .insert(organization)
      .values({ name: `Invoice Editor ${label}`, slug: `inv-edit-${label}-${crypto.randomUUID()}` })
      .returning({ id: organization.id });
    return row.id;
  }

  async function givenAnInvoice(priceMinor = 5_000) {
    const created = await invoices.createInvoice(orgId, {
      items: lines(priceMinor),
      notes: "First version",
    });
    return created;
  }

  it("rewritesTheNotesAndDueDate_withoutTouchingTheTotal", async () => {
    const created = await givenAnInvoice();

    const updated = await invoices.updateInvoice(orgId, created.id, {
      notes: "Reissued after the customer moved address",
      dueDate: "2027-03-09",
    });

    expect(updated.notes).toBe("Reissued after the customer moved address");
    expect(updated.dueDate).not.toBeNull();
    expect(updated.totalMinor).toBe(created.totalMinor);
    expect(updated.invoiceNumber).toBe(created.invoiceNumber);
  });

  it("recomputesTheSubtotal_andReplacesTheLines_whenItemsChange", async () => {
    const created = await givenAnInvoice(5_000);

    const updated = await invoices.updateInvoice(orgId, created.id, {
      items: [
        { description: "Repair labour", quantity: 1, unitPriceMinor: 5_000 },
        { description: "Parts", quantity: 2, unitPriceMinor: 1_250 },
      ],
    });

    expect(updated.subtotalMinor).toBe(7_500);
    expect(updated.totalMinor).toBe(7_500);
    expect(updated.items).toHaveLength(2);

    const stored = await db.select().from(invoiceItem).where(eq(invoiceItem.invoiceId, created.id));
    expect(stored).toHaveLength(2);
  });

  it("appliesANewDiscountToTheStoredTotal", async () => {
    const created = await givenAnInvoice(5_000);

    const updated = await invoices.updateInvoice(orgId, created.id, { discountMinor: 500 });

    expect(updated.discountMinor).toBe(500);
    expect(updated.totalMinor).toBe(4_500);
  });

  it("refusesADiscountThatOutrunsTheSubtotal_evenWhenTaxKeepsTheTotalPositive", async () => {
    const created = await givenAnInvoice(5_000);

    // Chosen so only the discount rule can catch it: the total would still be a
    // positive 1,000, so a suite that only checked the total would let this
    // through and the invoice would show a discount larger than what it bills.
    await expect(
      invoices.updateInvoice(orgId, created.id, { discountMinor: 6_000, taxMinor: 2_000 }),
    ).rejects.toThrow("Discount cannot exceed the subtotal.");
  });

  it("clearsTheDueDate_whenNoneIsSentAnymore", async () => {
    const created = await givenAnInvoice();
    await invoices.updateInvoice(orgId, created.id, { dueDate: "2027-01-01" });

    const cleared = await invoices.updateInvoice(orgId, created.id, { dueDate: null });

    expect(cleared.dueDate).toBeNull();
    expect(cleared.notes).toBe("First version");
  });

  describe("once the invoice has closed", () => {
    it("refusesToChangeAPaidInvoice", async () => {
      const created = await givenAnInvoice();
      await db.update(invoice).set({ status: "paid" }).where(eq(invoice.id, created.id));

      await expect(
        invoices.updateInvoice(orgId, created.id, { notes: "Too late" }),
      ).rejects.toThrow("cannot be changed");
    });

    it("refusesToDeleteAPaidInvoice_andLeavesItInPlace", async () => {
      const created = await givenAnInvoice();
      await db.update(invoice).set({ status: "void" }).where(eq(invoice.id, created.id));

      await expect(invoices.removeInvoice(orgId, created.id)).rejects.toThrow("cannot be changed");

      const [stillThere] = await db
        .select({ id: invoice.id })
        .from(invoice)
        .where(eq(invoice.id, created.id));
      expect(stillThere).toBeDefined();
    });
  });

  it("deletesAnOpenInvoice_andItsLinesWithIt", async () => {
    const created = await givenAnInvoice();

    expect(await invoices.removeInvoice(orgId, created.id)).toEqual({
      id: created.id,
      deleted: true,
    });

    const [gone] = await db
      .select({ id: invoice.id })
      .from(invoice)
      .where(eq(invoice.id, created.id));
    expect(gone).toBeUndefined();

    const linesLeft = await db
      .select({ id: invoiceItem.id })
      .from(invoiceItem)
      .where(eq(invoiceItem.invoiceId, created.id));
    expect(linesLeft).toHaveLength(0);
  });

  it("doesNotLetAnotherBusinessSeeTheInvoiceAtAll", async () => {
    const created = await givenAnInvoice();

    await expect(
      invoices.updateInvoice(rivalOrgId, created.id, { notes: "Not mine" }),
    ).rejects.toThrow("Invoice not found.");
    await expect(invoices.removeInvoice(rivalOrgId, created.id)).rejects.toThrow(
      "Invoice not found.",
    );
  });
});
