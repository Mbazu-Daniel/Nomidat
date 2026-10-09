import { Inject, Injectable } from "@nestjs/common";
import { eq } from "@nomidat/db";
import { organization } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { orderTotals } from "./order-money";
import type { MoneyPolicy, OrderMoneyLine, PolicyOrderTotals } from "./types/money.type";

const DEFAULT_POLICY: MoneyPolicy = { currency: "NGN", taxRateBps: 750 };

/**
 * Owns "what money means" for a business: the currency it trades in, the tax it
 * charges, and the arithmetic that turns lines of minor units into an amount
 * owed. Amounts are stored as integers in the currency's minor unit, so a
 * business trading in dollars stores 450 meaning $4.50 and the same arithmetic
 * still works.
 *
 * One seam for one invariant: a caller states what was sold and gets back what it
 * costs. Nothing else decides a tax rate, and nothing else rounds an Order.
 */
@Injectable()
export class MoneyPolicyService {
  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}

  async getPolicy(organizationId: string): Promise<MoneyPolicy> {
    const [row] = await this.db
      .select({ currency: organization.currency, taxRateBps: organization.taxRateBps })
      .from(organization)
      .where(eq(organization.id, organizationId))
      .limit(1);

    if (!row) return DEFAULT_POLICY;
    return { currency: row.currency, taxRateBps: row.taxRateBps };
  }

  /**
   * What an Order of these lines costs this business, and in what currency.
   *
   * The tax rate comes from the business, never from the caller. A till, a public
   * shop and the assistant all land here, so a business in another tax regime is
   * not charged this one — and a caller cannot post a tax of zero to sell tax
   * free.
   */
  async orderTotals(
    organizationId: string,
    lines: OrderMoneyLine[],
    discountMinor = 0,
  ): Promise<PolicyOrderTotals> {
    const { currency, taxRateBps } = await this.getPolicy(organizationId);
    return { currency, ...orderTotals(taxRateBps, lines, discountMinor) };
  }
}
