import { eq, sql } from "@nomidat/db";
import { createDb, type DatabaseClient } from "@nomidat/db";
import { organization, payoutRequest, walletEntry } from "@nomidat/db/schema";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { WalletRepository } from "../src/modules/payouts/wallet.repository";
import { WalletService } from "../src/modules/payouts/wallet.service";

/**
 * The wallet holds a tenant's real money, and every figure below is money that
 * left or entered a business. These run against a real Postgres because the
 * defects they cover live in SQL and in transaction boundaries — a stubbed
 * database would have passed while the balance was wrong.
 *
 * Set TEST_DATABASE_URL to a disposable database whose name ends in `_test`.
 * Without it the suite skips rather than running against a developer's data.
 */
const connectionString = process.env.TEST_DATABASE_URL;

describe.skipIf(!connectionString)("wallet", () => {
  let db: DatabaseClient;
  let wallet: WalletService;
  let orgId: string;

  beforeAll(async () => {
    if (!connectionString) return;
    // These tests create and delete rows. A hard failure beats a silent skip, so
    // a database name that is not obviously disposable stops the run outright.
    if (!new URL(connectionString).pathname.endsWith("_test")) {
      throw new Error(
        `TEST_DATABASE_URL must name a database ending in "_test", got "${connectionString}".`,
      );
    }
    db = createDb(connectionString);
    wallet = new WalletService(db, new WalletRepository(db));
  });

  afterAll(async () => {
    await db?.close();
  });

  afterEach(async () => {
    if (!connectionString) return;
    await db.delete(walletEntry).where(eq(walletEntry.organizationId, orgId));
    await db.delete(payoutRequest).where(eq(payoutRequest.organizationId, orgId));
    await db.delete(organization).where(eq(organization.id, orgId));
  });

  async function givenABusinessWithABalance(balanceMinor: number) {
    const [created] = await db
      .insert(organization)
      .values({ name: "Test Trader", slug: `wallet-${crypto.randomUUID()}` })
      .returning({ id: organization.id });
    orgId = created.id;
    if (balanceMinor > 0) {
      await wallet.openWithBalance(orgId, balanceMinor);
    }
    return orgId;
  }

  const bankDetails = {
    bankCode: "058",
    bankName: "Guaranty Trust",
    accountNumber: "0123456789",
    accountName: "Test Trader",
  };

  it("withdraws_theFullBalance_whenNothingIsOwed_leavesZero", async () => {
    const org = await givenABusinessWithABalance(100_000);

    await wallet.requestWithdrawal(org, null, { amountMinor: 100_000, ...bankDetails });

    expect(await wallet.getBalance(org)).toEqual({ balanceMinor: 0 });
  });

  it("refuses_aSecondWithdrawal_whenTheBalanceWasAlreadySpent", async () => {
    const org = await givenABusinessWithABalance(100_000);
    await wallet.requestWithdrawal(org, null, { amountMinor: 100_000, ...bankDetails });

    // The tenant has nothing left. Paying this out would be platform money.
    await expect(
      wallet.requestWithdrawal(org, null, { amountMinor: 100_000, ...bankDetails }),
    ).rejects.toThrow("more than the available balance");
  });

  it("records_aBalancedRunningTotal_whenMoneyMovesBothWays", async () => {
    const org = await givenABusinessWithABalance(100_000);
    await wallet.requestWithdrawal(org, null, { amountMinor: 30_000, ...bankDetails });
    await wallet.openWithBalance(org, 5_000);

    const entries = await wallet.getEntries(org);
    const balances = entries.map((entry) => entry.balanceAfterMinor);

    // Newest first, as `getEntries` orders them. Every snapshot must agree with
    // the balance the tenant would be told about.
    expect(balances).toEqual([75_000, 70_000, 100_000]);
    expect(await wallet.getBalance(org)).toEqual({ balanceMinor: 75_000 });
  });

  it("credits_theNetAmount_whenAPlatformFeeIsConfigured", async () => {
    const org = await givenABusinessWithABalance(0);

    // A ₦100,000 payment less a 7.5% fee leaves ₦92,500.
    const result = await wallet.creditPayment(org, {
      amountMinor: 10_000_000,
      platformFeeBps: 750,
      currency: "NGN",
      reference: "pay_fee_1",
    });

    expect(result).toMatchObject({ credited: true, feeMinor: 750_000, netMinor: 9_250_000 });
    expect(await wallet.getBalance(org)).toEqual({ balanceMinor: 9_250_000 });
  });

  it("restores_theFunds_once_whenAWithdrawalIsRefusedTwiceConcurrently", async () => {
    const org = await givenABusinessWithABalance(100_000);
    const request = await wallet.requestWithdrawal(org, null, {
      amountMinor: 60_000,
      ...bankDetails,
    });

    const results = await Promise.allSettled([
      wallet.refundRequest(org, request.id, "Bank details wrong"),
      wallet.refundRequest(org, request.id, "Bank details wrong"),
    ]);

    // One decision refunds once. A second credit would invent money.
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await wallet.getBalance(org)).toEqual({ balanceMinor: 100_000 });
  });

  it("leaves_theBalanceIntact_whenTheWithdrawalRequestCannotBeRecorded", async () => {
    const org = await givenABusinessWithABalance(100_000);

    // The request cannot name a user that does not exist, so the insert is
    // rejected by the database. The reserved funds must come back with it.
    await expect(
      wallet.requestWithdrawal(org, "00000000-0000-0000-0000-000000000000", {
        amountMinor: 40_000,
        ...bankDetails,
      }),
    ).rejects.toThrow();

    expect(await wallet.getBalance(org)).toEqual({ balanceMinor: 100_000 });
  });

  it("refuses_aPayoutAboveTheBalance_whenTwoRequestsRace", async () => {
    const org = await givenABusinessWithABalance(100_000);

    const results = await Promise.allSettled([
      wallet.requestWithdrawal(org, null, { amountMinor: 80_000, ...bankDetails }),
      wallet.requestWithdrawal(org, null, { amountMinor: 80_000, ...bankDetails }),
    ]);

    // Reserving 80,000 twice against a 100,000 balance would over-reserve.
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await wallet.getBalance(org)).toEqual({ balanceMinor: 20_000 });
  });

  it("counts_eachRowOnce_whenTheLedgerIsSummed", async () => {
    const org = await givenABusinessWithABalance(100_000);
    await wallet.requestWithdrawal(org, null, { amountMinor: 20_000, ...bankDetails });

    // A debit is money out. Summing the column alone would call this 120,000.
    const [{ total }] = await db
      .select({ total: sql<number>`coalesce(sum(${walletEntry.amountMinor}), 0)` })
      .from(walletEntry)
      .where(eq(walletEntry.organizationId, org));

    expect(Number(total)).toBe(120_000);
    expect(await wallet.getBalance(org)).toEqual({ balanceMinor: 80_000 });
  });
});
