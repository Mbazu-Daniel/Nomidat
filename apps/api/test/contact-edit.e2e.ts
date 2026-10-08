import { eq } from "@nomidat/db";
import { createDb, type DatabaseClient } from "@nomidat/db";
import { contact, member, note, order, organization, user } from "@nomidat/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ContactsService } from "../src/modules/contacts/contacts.service";
import { SalesQueriesService } from "../src/modules/sales/sales-queries.service";

/**
 * Editing and archiving a contact.
 *
 * Phone is the case that matters: it is what routes a customer's WhatsApp and
 * Telegram messages to this business, so a typo sends their messages somewhere
 * else and there was no way to correct one. These run against a real database
 * because the behaviour under test is partly the query — archived contacts
 * leaving the working list while their history stays intact.
 *
 * Set TEST_DATABASE_URL to a database whose name ends in `_test`.
 */
const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)("editing a contact", () => {
  let db: DatabaseClient;
  let contacts: ContactsService;
  let orgId: string;

  beforeAll(async () => {
    if (!connectionString) return;
    if (!new URL(connectionString).pathname.endsWith("_test")) {
      throw new Error(
        `TEST_DATABASE_URL must name a database ending in "_test", got "${connectionString}".`,
      );
    }
    db = createDb(connectionString);
    contacts = new ContactsService(db, new SalesQueriesService(db));

    const [org] = await db
      .insert(organization)
      .values({ name: "Test Trader", slug: `contacts-${crypto.randomUUID()}` })
      .returning({ id: organization.id });
    orgId = org.id;
  });

  afterAll(async () => {
    if (!connectionString) return;
    await db.delete(organization).where(eq(organization.id, orgId));
    await db.close();
  });

  /** A real user, because a note records who wrote it. */
  async function givenAStaffMember() {
    const [person] = await db
      .insert(user)
      .values({ name: "Ada", email: `staff-${crypto.randomUUID()}@example.com` })
      .returning({ id: user.id });
    await db.insert(member).values({ organizationId: orgId, userId: person.id, role: "owner" });
    return person.id;
  }

  async function givenACustomer(overrides: Partial<typeof contact.$inferInsert> = {}) {
    const [row] = await db
      .insert(contact)
      .values({
        organizationId: orgId,
        name: `Ada ${crypto.randomUUID().slice(0, 6)}`,
        kind: "customer",
        source: "dashboard",
        ...overrides,
      })
      .returning({ id: contact.id });
    return row.id;
  }

  it("correctsATypoInThePhoneNumber", async () => {
    const id = await givenACustomer({ phone: "08031234567" });

    const updated = await contacts.updateContact(orgId, id, { phone: "08039876543" });

    // The whole point of the route: a mistyped number used to be unfixable.
    expect(updated.phone).toBe("08039876543");
    expect(updated.name).toBeTruthy();
  });

  it("leavesOtherFieldsAlone_whenOnlyThePhoneIsSent", async () => {
    const name = `Chidi ${crypto.randomUUID().slice(0, 6)}`;
    const id = await givenACustomer({ name, phone: "08030000000", email: "c@example.com" });

    const updated = await contacts.updateContact(orgId, id, { phone: "08031111111" });

    // A partial edit must not blank what it was not asked to change.
    expect(updated.name).toBe(name);
    expect(updated.email).toBe("c@example.com");
    expect(updated.kind).toBe("customer");
  });

  it("clearsTheNumber_whenAnEmptyOneIsSent", async () => {
    const id = await givenACustomer({ phone: "08032222222" });

    const updated = await contacts.updateContact(orgId, id, { phone: "" });

    // Stored as null rather than "": an empty string would pass a length check and
    // then compare equal to nothing in a search.
    expect(updated.phone).toBeNull();
  });

  it("renamesTheContact", async () => {
    const id = await givenACustomer({ name: "Old Name" });

    const updated = await contacts.updateContact(orgId, id, { name: "New Name" });

    expect(updated.name).toBe("New Name");
  });

  it("refusesAnEdit_thatNamesNothing", async () => {
    const id = await givenACustomer();

    // Otherwise a PATCH with an empty body would silently report success.
    await expect(contacts.updateContact(orgId, id, {})).rejects.toThrow(
      "Provide at least one field to change.",
    );
  });

  it("refusesAnEdit_whenTheContactIsInAnotherBusiness", async () => {
    const [rival] = await db
      .insert(organization)
      .values({ name: "Rival Shop", slug: `rival-${crypto.randomUUID()}` })
      .returning({ id: organization.id });
    const theirs = await givenACustomer({ phone: "08037777777" });

    await expect(
      contacts.updateContact(rival.id, theirs, { phone: "08030000000" }),
    ).rejects.toThrow("Contact not found.");

    // And the change did not land either.
    const [after] = await db.select().from(contact).where(eq(contact.id, theirs));
    expect(after.phone).toBe("08037777777");

    await db.delete(organization).where(eq(organization.id, rival.id));
  });

  it("hidesTheContactFromTheWorkingList_whenItIsArchived", async () => {
    const id = await givenACustomer({ name: "Archived One" });

    await contacts.archiveContact(orgId, id);

    const active = await contacts.getContacts(orgId);
    expect(active.map((row) => row.id)).not.toContain(id);

    // Findable in the archived list, so the row is reversible rather than lost.
    const archived = await contacts.getArchivedContacts(orgId);
    expect(archived.map((row) => row.id)).toContain(id);
  });

  it("keepsTheHistory_whenAContactIsArchived", async () => {
    const id = await givenACustomer();
    await contacts.createNote(orgId, id, await givenAStaffMember(), {
      body: "Called about a delivery",
    });
    await db.insert(order).values({
      organizationId: orgId,
      contactId: id,
      orderNumber: `ORD-${crypto.randomUUID().slice(0, 8)}`,
      subtotalMinor: 5_000,
      totalMinor: 5_000,
    });

    await contacts.archiveContact(orgId, id);

    // An order or invoice already points at this row. Deleting it would leave
    // history with nothing to point at, which is why this archives.
    const notes = await db.select().from(note).where(eq(note.contactId, id));
    const orders = await db.select().from(order).where(eq(order.contactId, id));
    expect(notes).toHaveLength(1);
    expect(orders).toHaveLength(1);

    const folder = await contacts.getClientFolder(orgId, id);
    expect(folder.contact.isActive).toBe(false);
    expect(folder.orders).toHaveLength(1);
  });

  it("refusesToArchiveTwice", async () => {
    const id = await givenACustomer();
    await contacts.archiveContact(orgId, id);

    // The second archive is a no-op the caller should hear about rather than a
    // success that changed nothing.
    await expect(contacts.archiveContact(orgId, id)).rejects.toThrow("Contact not found.");
  });

  it("refusesToEditAnArchivedContact", async () => {
    const id = await givenACustomer({ phone: "08034444444" });
    await contacts.archiveContact(orgId, id);

    // Restoring one is a deliberate act, not a side effect of editing it.
    await expect(contacts.updateContact(orgId, id, { phone: "08035555555" })).rejects.toThrow(
      "Contact not found.",
    );
  });
});
