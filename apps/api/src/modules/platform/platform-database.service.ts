import { Inject, Injectable } from "@nestjs/common";
import { count, desc, eq, sum } from "@nomidat/db";
import { order, organization, payment, user } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";

const MAX_ORGANIZATIONS = 100;

/**
 * Aggregates for the platform operator.
 *
 * Intentionally returns counts and sums rather than rows. There is no method here
 * that returns a tenant's customers, invoices or payments, because every such
 * method is one forgotten check away from becoming a data breach.
 */
@Injectable()
export class PlatformDatabaseService {
  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}

  async getOverview() {
    const [[orgs], [users], [orders], [collected], recentOrganizations] = await Promise.all([
      this.db.select({ value: count() }).from(organization),
      this.db.select({ value: count() }).from(user),
      this.db.select({ value: count() }).from(order),
      this.db.select({ totalMinor: sum(payment.amountMinor) }).from(payment),
      this.db
        .select({ id: organization.id, createdAt: organization.createdAt })
        .from(organization)
        .orderBy(desc(organization.createdAt))
        .limit(5),
    ]);

    return {
      organizationCount: Number(orgs?.value ?? 0),
      userCount: Number(users?.value ?? 0),
      orderCount: Number(orders?.value ?? 0),
      // Volume across all tenants, in whatever currencies they bill in. Not
      // summed into a single figure, because that would be meaningless money.
      collectedByCurrency: await this.collectedByCurrency(),
      totalCollectedMinor: Number(collected?.totalMinor ?? 0),
      recentOrganizations: recentOrganizations.map((row) => row.id),
    };
  }

  async getOrganizations() {
    return this.db
      .select({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        currency: organization.currency,
        createdAt: organization.createdAt,
      })
      .from(organization)
      .orderBy(desc(organization.createdAt))
      .limit(MAX_ORGANIZATIONS);
  }

  /** One tenant's headline numbers. Counts only, no record contents. */
  async getOrganizationActivity(organizationId: string) {
    const [[orderCount], [paymentCount], [existing]] = await Promise.all([
      this.db
        .select({ value: count() })
        .from(order)
        .where(eq(order.organizationId, organizationId)),
      this.db
        .select({ value: count() })
        .from(payment)
        .where(eq(payment.organizationId, organizationId)),
      this.db
        .select({ name: organization.name, slug: organization.slug })
        .from(organization)
        .where(eq(organization.id, organizationId))
        .limit(1),
    ]);

    return {
      organizationId,
      name: existing?.name ?? null,
      slug: existing?.slug ?? null,
      orderCount: Number(orderCount?.value ?? 0),
      paymentCount: Number(paymentCount?.value ?? 0),
    };
  }

  private async collectedByCurrency() {
    const rows = await this.db
      .select({ currency: payment.currency, totalMinor: sum(payment.amountMinor) })
      .from(payment)
      .groupBy(payment.currency);
    return rows.map((row) => ({
      currency: row.currency,
      totalMinor: Number(row.totalMinor ?? 0),
    }));
  }
}
