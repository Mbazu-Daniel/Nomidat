import { eq } from "@nomidat/db";
import { createDb, type DatabaseClient } from "@nomidat/db";
import { businessProfile, organization } from "@nomidat/db/schema";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { BusinessProfileService } from "../src/modules/business-profile/business-profile.service";

/**
 * A profile is per-business and unique on organizationId. The status read is the
 * only surface the service exposes, so this covers what it answers and that it
 * never reports one business's profile as another's.
 */
const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)("business profile", () => {
  let db: DatabaseClient;
  let profiles: BusinessProfileService;
  let orgIds: string[];

  beforeAll(async () => {
    if (!connectionString) return;
    if (!new URL(connectionString).pathname.endsWith("_test")) {
      throw new Error(
        `TEST_DATABASE_URL must name a database ending in "_test", got "${connectionString}".`,
      );
    }
    db = createDb(connectionString);
    profiles = new BusinessProfileService(db);
    orgIds = [];
  });

  afterAll(async () => {
    await db?.close();
  });

  afterEach(async () => {
    if (!connectionString) return;
    for (const orgId of orgIds) {
      await db.delete(businessProfile).where(eq(businessProfile.organizationId, orgId));
      await db.delete(organization).where(eq(organization.id, orgId));
    }
    orgIds = [];
  });

  async function givenABusiness() {
    const [created] = await db
      .insert(organization)
      .values({ name: "Test Trader", slug: `profile-${crypto.randomUUID()}` })
      .returning({ id: organization.id });
    orgIds.push(created.id);
    return created.id;
  }

  it("reports_noProfile_whenOneHasNeverBeenSaved", async () => {
    const org = await givenABusiness();
    expect(await profiles.getStatus(org)).toEqual({ hasProfile: false });
  });

  it("reports_aProfile_whenOneExists", async () => {
    const org = await givenABusiness();
    await db.insert(businessProfile).values({ organizationId: org, name: "Test Trader" });

    expect(await profiles.getStatus(org)).toEqual({ hasProfile: true });
  });

  it("reports_noProfile_whenAskedAboutABusinessThatDoesNotExist", async () => {
    expect(await profiles.getStatus("00000000-0000-0000-0000-000000000000")).toEqual({
      hasProfile: false,
    });
  });

  it("keepsProfilesApart_whenTwoBusinessesSaveOne", async () => {
    const first = await givenABusiness();
    const second = await givenABusiness();
    await db.insert(businessProfile).values({ organizationId: first, name: "First" });

    // One business's profile must never satisfy another's status check.
    expect(await profiles.getStatus(first)).toEqual({ hasProfile: true });
    expect(await profiles.getStatus(second)).toEqual({ hasProfile: false });
  });

  it("keepsOneRowPerBusiness_whenAProfileIsSavedTwice", async () => {
    const org = await givenABusiness();
    // Mirrors the upsert the save path performs, to prove the unique index holds.
    const values = {
      organizationId: org,
      name: "Test Trader",
      businessDetails: { address: "12 Market Road" },
    };
    await db.insert(businessProfile).values(values).onConflictDoNothing();
    await db
      .insert(businessProfile)
      .values({
        organizationId: org,
        name: "Test Trader",
        businessDetails: { address: "34 Broad Street" },
      })
      .onConflictDoUpdate({
        target: businessProfile.organizationId,
        set: { businessDetails: { address: "34 Broad Street" }, updatedAt: new Date() },
      });

    const rows = await db
      .select({ name: businessProfile.name })
      .from(businessProfile)
      .where(eq(businessProfile.organizationId, org));

    // A duplicate would print the business twice on every invoice.
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("Test Trader");
  });
});
