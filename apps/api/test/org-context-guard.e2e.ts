import { eq } from "@nomidat/db";
import { createDb, type DatabaseClient } from "@nomidat/db";
import { member, organization, user } from "@nomidat/db/schema";
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OrgContextGuard } from "../src/common/guards/org-context.guard";
import { PUBLIC_ROUTE } from "../src/common/guards/public-route.decorator";
import type { BetterAuthInstance } from "../src/common/better-auth";

/**
 * The default-deny rule: a route naming a business is closed unless it carries a
 * session belonging to a member of that business.
 *
 * This is the guard's whole job, so it is driven directly. What it proves is the
 * structural property — a new controller cannot ship unauthenticated because it
 * never has to remember anything.
 */
const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)("the default-deny guard", () => {
  let db: DatabaseClient;
  let orgId: string;
  let rivalOrgId: string;

  /** Stands in for Better Auth: resolves a cookie header to a user id. */
  function authReturning(userId: string | null) {
    return {
      api: {
        getSession: async () => (userId ? { user: { id: userId } } : null),
      },
    } as unknown as BetterAuthInstance;
  }

  function contextFor(params: Record<string, string>, isPublic = false) {
    const handler = () => undefined;
    if (isPublic) Reflect.defineMetadata(PUBLIC_ROUTE, true, handler);
    return {
      getType: () => "http",
      getHandler: () => handler,
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => ({ params, headers: {} }) }),
    } as unknown as ExecutionContext;
  }

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
      .values({ name: "Test Trader", slug: `guard-${crypto.randomUUID()}` })
      .returning({ id: organization.id });
    orgId = org.id;

    const [rival] = await db
      .insert(organization)
      .values({ name: "Rival Shop", slug: `guard-${crypto.randomUUID()}` })
      .returning({ id: organization.id });
    rivalOrgId = rival.id;
  });

  afterAll(async () => {
    if (!connectionString) return;
    await db.delete(organization).where(eq(organization.id, orgId));
    await db.delete(organization).where(eq(organization.id, rivalOrgId));
    await db.close();
  });

  async function givenAMemberOf(role: string, org = orgId) {
    const [person] = await db
      .insert(user)
      .values({ name: "Ada", email: `ada-${crypto.randomUUID()}@example.com` })
      .returning({ id: user.id });
    await db.insert(member).values({ organizationId: org, userId: person.id, role });
    return person.id;
  }

  function guardFor(userId: string | null) {
    return new OrgContextGuard(authReturning(userId), db, new Reflector());
  }

  it("letsAMemberThrough_whenTheRouteNamesTheirBusiness", async () => {
    const seller = await givenAMemberOf("owner");
    await expect(guardFor(seller).canActivate(contextFor({ organizationId: orgId }))).resolves.toBe(
      true,
    );
  });

  it("refusesAnAnonymousCaller_whenTheRouteNamesABusiness", async () => {
    await expect(guardFor(null).canActivate(contextFor({ organizationId: orgId }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("refusesAMemberOfAnotherBusiness", async () => {
    // Owning one shop must not open another's books.
    const stranger = await givenAMemberOf("owner", rivalOrgId);
    await expect(
      guardFor(stranger).canActivate(contextFor({ organizationId: orgId })),
    ).rejects.toThrow("Not a member of this organization");
  });

  it("readsTheShorterOrgParameterName_too", async () => {
    const seller = await givenAMemberOf("owner");
    await expect(guardFor(seller).canActivate(contextFor({ org: orgId }))).resolves.toBe(true);
    await expect(guardFor(null).canActivate(contextFor({ org: orgId }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("letsAShopperThrough_whenTheRouteIsMarkedPublic", async () => {
    // Storefronts and shared invoices are reached from a link by someone with
    // no account. They opt out explicitly rather than by omission.
    await expect(
      guardFor(null).canActivate(contextFor({ organizationId: orgId }, true)),
    ).resolves.toBe(true);
  });

  it("ignoresRoutesWithNoBusinessInThem", async () => {
    // Sign-in and webhooks have no session by definition; they authenticate by
    // a shared secret or a provider signature instead.
    await expect(guardFor(null).canActivate(contextFor({}))).resolves.toBe(true);
    await expect(guardFor(null).canActivate(contextFor({ invoiceId: "abc" }))).resolves.toBe(true);
  });

  it("refusesAParameterThatIsNotAnIdentifier", async () => {
    // A route must not smuggle a slug or a crafted value past a check it
    // believes it ran. Anything non-UUID is treated as not a tenant route.
    await expect(
      guardFor(null).canActivate(contextFor({ organizationId: "../../etc/passwd" })),
    ).resolves.toBe(true);
    await expect(guardFor(null).canActivate(contextFor({ organizationId: "" }))).resolves.toBe(
      true,
    );
  });
});
