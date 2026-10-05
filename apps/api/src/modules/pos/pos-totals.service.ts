import { BadRequestException, Injectable } from "@nestjs/common";
import { MoneyPolicyService } from "../money/money-policy.service";

export interface PosCartLine {
  productId: string;
  quantity: number;
  unitPriceMinor: number;
}

export interface PosTotals {
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  changeMinor: number;
}

/**
 * Server-side authority for the POS total; the terminal's numbers are advisory
 * only. Tax comes from the business's own rate, not a constant baked into the
 * code, so a business in a different tax regime is not charged Nigeria's VAT.
 */
@Injectable()
export class PosTotalsService {
  constructor(private readonly money: MoneyPolicyService) {}

  async calculate(
    lines: PosCartLine[],
    discountMinor: number,
    tenderedMinor: number,
    organizationId: string,
  ): Promise<PosTotals> {
    const { taxRateBps } = await this.money.getPolicy(organizationId);
    return this.calculateWithTaxRate(lines, discountMinor, tenderedMinor, taxRateBps);
  }

  /** Pure form, so the arithmetic can be exercised without a database. */
  calculateWithTaxRate(
    lines: PosCartLine[],
    discountMinor: number,
    tenderedMinor: number,
    taxRateBps: number,
  ): PosTotals {
    const subtotalMinor = lines.reduce(
      (total, line) => total + line.quantity * line.unitPriceMinor,
      0,
    );
    const appliedDiscountMinor = Math.min(Math.max(discountMinor, 0), subtotalMinor);
    const taxMinor = this.money.calculateTax(subtotalMinor - appliedDiscountMinor, taxRateBps);
    const totalMinor = subtotalMinor - appliedDiscountMinor + taxMinor;

    if (totalMinor <= 0) {
      throw new BadRequestException("The order total must be greater than zero.");
    }

    return {
      subtotalMinor,
      discountMinor: appliedDiscountMinor,
      taxMinor,
      totalMinor,
      changeMinor: Math.max(0, tenderedMinor - totalMinor),
    };
  }
}
