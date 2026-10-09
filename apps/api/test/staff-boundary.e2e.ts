import { eq } from "@nomidat/db";
import { createDb, type DatabaseClient } from "@nomidat/db";
import { member, organization, user } from "@nomidat/db/schema";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { requireMembership } from "../src/modules/organization-summary/organization-membership";
import { OrganizationAuthService } from "../src/modules/organization-summary/organization-auth.service";
import { SalesQueriesService } from "../src/modules/sales/sales-queries.service";

/**
 * Who may change what, and whose records those changes belong to.
 *
 * `authorizeWrite` is the whole permission model, so these drive it directly
 * rather than through HTTP: the rules are a pure function of the member's role
 * string, and the membership lookup is the one place a caller is proven to
 * belong to the business whose data it is about to touch.
 *
 * Set TEST_DATABASE_URL to a database whose name ends in `_test`.
 */
const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)("the staff boundary", () => {
  let db: DatabaseClient;
  let queries: SalesQueriesService;
  // Only the write rule is exercised: a session needs a real Better Auth
  // instance, and the rule it feeds is a pure function of the role.
  let authorizeWrite: (role: string, area?: string) => void;
  let orgId: string;

  beforeAll(async () => {
    if (!connectionString) return;
    if (!new URL(connectionString).pathname.endsWith("_test")) {
      throw new Error(
        `TEST_DATABASE_URL must name a database ending in "_test", got "${connectionString}".`,
      );
    }
    db = createDb(connectionString);
    queries = new SalesQueriesService(db);
    // The write rule reads only the role string, so it is driven off the
    // prototype: a real instance would need a session and an env block, and
    // neither is what is under test here.
    authorizeWrite = (role, area) =>
      OrganizationAuthService.prototype.authorizeWrite.call(null, role, area);

    const [org] = await db
      .insert(organization)
      .values({ name: "Test Trader", slug: `auth-${crypto.randomUUID()}` })
      .returning({ id: organization.id });
    orgId = org.id;
  });

  afterAll(async () => {
    if (!connectionString) return;
    await db.delete(organization).where(eq(organization.id, orgId));
    await db.close();
  });

  async function givenAMember(role: string) {
    const [person] = await db
      .insert(user)
      .values({ name: "Ada", email: `ada-${crypto.randomUUID()}@example.com` })
      .returning({ id: user.id });
    await db.insert(member).values({ organizationId: orgId, userId: person.id, role });
    return person.id;
  }

  it("letsTheOwnerChangeAnything", () => {
    expect(() => authorizeWrite("owner")).not.toThrow();
  });

  it("refusesAStaffMember_withNoWriteRoleAtAll", () => {
    // A plain member can read the books and must not silently alter them.
    expect(() => authorizeWrite("member")).toThrow(
      "You do not have permission to change these business records.",
    );
  });

  it("refusesAStaffMember_whoseOnlyRoleIsReadingSales", () => {
    expect(() => authorizeWrite("sales_reader")).toThrow(
      "You do not have permission to change these business records.",
    );
  });

  it("letsASalesWriterChangeSales_only", () => {
    // The role that can take money may not rename the business's bank details.
    expect(() => authorizeWrite("sales_writer", "sales")).not.toThrow();
    expect(() => authorizeWrite("sales_writer", "expenses")).toThrow(
      "You do not have permission to change these business records.",
    );
  });

  it("acceptsAStaffMember_holdingSeveralRoles", () => {
    // Roles arrive comma-separated from Better Auth, so "reader,sales_writer"
    // must grant on the strength of the one that can write.
    expect(() => authorizeWrite("sales_reader,sales_writer", "sales")).not.toThrow();
  });

  it("refusesAUser_whoIsNotAMemberOfTheBusiness", async () => {
    const outsider = await givenAMember("owner");
    const [rival] = await db
      .insert(organization)
      .values({ name: "Rival Shop", slug: `rival-${crypto.randomUUID()}` })
      .returning({ id: organization.id });

    // Owning one business must not grant anything in another.
    await expect(requireMembership(db, rival.id, outsider)).rejects.toThrow(
      "Not a member of this organization",
    );

    await db.delete(organization).where(eq(organization.id, rival.id));
  });

  it("confirmsMembership_onlyForTheBusinessTheUserBelongsTo", async () => {
    const staff = await givenAMember("sales_writer");

    expect((await requireMembership(db, orgId, staff)).role).toBe("sales_writer");
    await expect(
      requireMembership(db, "00000000-0000-0000-0000-000000000000", staff),
    ).rejects.toThrow("Not a member of this organization");
  });

  it("hidesOneBusinesssSales_fromAnother", async () => {
    // A sale is only readable through its own organization's id. Knowing a
    // sale id must not be enough to read it from the wrong business.
    const [rival] = await db
      .insert(organization)
      .values({ name: "Rival Shop", slug: `rival-${crypto.randomUUID()}` })
      .returning({ id: organization.id });
    const [somebody] = await db
      .insert(user)
      .values({ name: "Emeka", email: `emeka-${crypto.randomUUID()}@example.com` })
      .returning({ id: user.id });
    await db
      .insert(member)
      .values({ organizationId: rival.id, userId: somebody.id, role: "owner" });

    const saleId = "00000000-0000-0000-0000-0000000000ff";
    await expect(queries.getSale(rival.id, saleId)).rejects.toThrow("Sale not found.");

    await db.delete(organization).where(eq(organization.id, rival.id));
  });
});
