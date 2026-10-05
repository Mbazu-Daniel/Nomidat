import { and, desc, eq, sql } from "@nomidat/db";
import { Inject, Injectable } from "@nestjs/common";
import { payoutRequest, walletEntry } from "@nomidat/db/schema";
import { DATABASE, type DbExecutor } from "../../common/db/db.provider";

/**
 * Data access for a tenant's balance.
 *
 * Split out so the service holds only rules. Every method here is either a read
 * or a single write with no policy in it; anything that decides whether money
 * moves belongs in the service.
 *
 * Each method takes an optional handle so it can join a caller's transaction.
 * The balance reads and writes are part of multi-statement flows that must be
 * atomic, and a repository that quietly used its own connection would break that.
 */
@Injectable()
export class WalletRepository {
  constructor(@Inject(DATABASE) private readonly db: DbExecutor) {}

  /**
   * The one place that decides which direction a movement goes.
   *
   * `amount_minor` is always positive — the column's own doc says storing signed
   * amounts "invites a sign error that silently credits a withdrawal" — so the
   * direction has to be applied here. Summing the column on its own adds
   * withdrawals and debits to the balance, which lets a tenant withdraw the same
   * money twice and leaves every `balanceAfterMinor` snapshot wrong.
   */
  async findBalance(organizationId: string, db: DbExecutor = this.db) {
    const [row] = await db
      .select({
        total: sql<number>`coalesce(sum(
          case when ${walletEntry.kind} in ('debit', 'withdrawal')
            then -${walletEntry.amountMinor}
            else ${walletEntry.amountMinor}
          end), 0)`,
      })
      .from(walletEntry)
      .where(eq(walletEntry.organizationId, organizationId));
    return Number(row?.total ?? 0);
  }

  async findEntries(organizationId: string, limit: number) {
    return this.db
      .select({
        id: walletEntry.id,
        kind: walletEntry.kind,
        amountMinor: walletEntry.amountMinor,
        currency: walletEntry.currency,
        balanceAfterMinor: walletEntry.balanceAfterMinor,
        reference: walletEntry.reference,
        description: walletEntry.description,
        createdAt: walletEntry.createdAt,
      })
      .from(walletEntry)
      .where(eq(walletEntry.organizationId, organizationId))
      .orderBy(desc(walletEntry.createdAt))
      .limit(Math.min(Math.max(limit, 1), 100));
  }

  findRequests(organizationId: string) {
    return this.db
      .select({
        id: payoutRequest.id,
        amountMinor: payoutRequest.amountMinor,
        currency: payoutRequest.currency,
        status: payoutRequest.status,
        bankName: payoutRequest.bankName,
        accountNumber: payoutRequest.accountNumber,
        accountName: payoutRequest.accountName,
        reason: payoutRequest.reason,
        decidedAt: payoutRequest.decidedAt,
        createdAt: payoutRequest.createdAt,
      })
      .from(payoutRequest)
      .where(eq(payoutRequest.organizationId, organizationId))
      .orderBy(desc(payoutRequest.createdAt))
      .limit(50);
  }

  async findRequest(organizationId: string, requestId: string) {
    const [row] = await this.db
      .select()
      .from(payoutRequest)
      .where(and(eq(payoutRequest.id, requestId), eq(payoutRequest.organizationId, organizationId)))
      .limit(1);
    return row ?? null;
  }

  /**
   * Adds a movement. Returns null when the reference is already taken, which is
   * what makes a redelivered webhook safe: the unique index rejects it here and
   * the caller stops rather than paying twice.
   */
  async insertEntry(
    entry: typeof walletEntry.$inferInsert,
    db: DbExecutor = this.db,
  ): Promise<{ id: string } | null> {
    const [row] = await db.insert(walletEntry).values(entry).onConflictDoNothing().returning({
      id: walletEntry.id,
    });
    return row ?? null;
  }

  /**
   * The handle is required, not defaulted. A default silently opens its own
   * connection, which is how reserving funds and recording the request ended up
   * in separate transactions — the debit committed and the request did not.
   */
  async insertPayoutRequest(
    request: typeof payoutRequest.$inferInsert,
    db: DbExecutor,
  ): Promise<{ id: string; status: string; createdAt: Date } | null> {
    const [row] = await db
      .insert(payoutRequest)
      .values(request)
      .returning({
        id: payoutRequest.id,
        status: payoutRequest.status,
        createdAt: payoutRequest.createdAt,
      });
    return row ?? null;
  }

  /**
   * Moves a request out of `fromStatus`, and only from there.
   *
   * The status belongs in the `WHERE` so a decision is made by the database
   * rather than by a read another caller can invalidate before the write.
   * Without it two concurrent refusals both decide to refund, and one of them
   * fails late — on a unique-index violation instead of on the conflict.
   *
   * Returns null when the request is absent or has already moved on.
   */
  async updatePayoutRequest(
    organizationId: string,
    requestId: string,
    fromStatus: string,
    patch: { status: string; reason?: string | null },
    db: DbExecutor,
  ) {
    const now = new Date();
    const [row] = await db
      .update(payoutRequest)
      .set({ ...patch, decidedAt: now, updatedAt: now })
      .where(
        and(
          eq(payoutRequest.id, requestId),
          eq(payoutRequest.organizationId, organizationId),
          eq(payoutRequest.status, fromStatus),
        ),
      )
      .returning({ id: payoutRequest.id, status: payoutRequest.status });
    return row ?? null;
  }

  /**
   * Takes a row lock for the tenant so two concurrent credits cannot both read
   * the same starting balance and overwrite one another's running total.
   */
  async lockEntries(organizationId: string, db: DbExecutor = this.db) {
    await db
      .select({ id: walletEntry.id })
      .from(walletEntry)
      .where(eq(walletEntry.organizationId, organizationId))
      .for("update");
  }

  async setBalanceOnEntry(entryId: string, balanceAfterMinor: number, db: DbExecutor = this.db) {
    await db.update(walletEntry).set({ balanceAfterMinor }).where(eq(walletEntry.id, entryId));
  }
}
