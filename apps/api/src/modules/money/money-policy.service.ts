import { Inject, Injectable } from "@nestjs/common";
import { eq } from "@nomidat/db";
import { organization } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";

export interface MoneyPolicy {
  /** ISO 4217 code, e.g. NGN, USD, GBP. */
  currency: string;
  /** Sales tax in basis points, e.g. 750 for 7.5%. */
  taxRateBps: number;
}

/** Currencies whose minor unit is the usual cent-style hundredth. */
const SUBUNIT_SCALE: Record<string, number> = {
  NGN: 100,
  USD: 100,
  EUR: 100,
  GBP: 100,
  ZAR: 100,
  KES: 100,
  GHS: 100,
  INR: 100,
  JPY: 1,
  KRW: 1,
  VND: 1,
};

const DEFAULT_POLICY: MoneyPolicy = { currency: "NGN", taxRateBps: 750 };

/**
 * Owns "what money means" for a business. Amounts are stored as integers in the
 * currency's minor unit, so a business trading in dollars stores 450 meaning
 * $4.50 and the same arithmetic still works.
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

  /** How many minor units make one whole unit, e.g. 100 for NGN, 1 for JPY. */
  minorUnitScale(currency: string): number {
    return SUBUNIT_SCALE[currency.toUpperCase()] ?? 100;
  }

  /** Tax on a minor-unit amount, rounded to a whole minor unit. */
  calculateTax(taxableMinor: number, taxRateBps: number): number {
    return Math.round((taxableMinor * taxRateBps) / 10_000);
  }
}
