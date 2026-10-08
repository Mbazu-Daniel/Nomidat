import { Inject, Injectable } from "@nestjs/common";
import { and, eq, sql } from "@nomidat/db";
import { product, productVariant, serialNumber } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { totalOnHandForVariantSql, totalOnHandSql } from "../inventory/stock-levels";
import { AuditService } from "../audit/audit.service";
import { MoneyPolicyService } from "../money/money-policy.service";
import { SalePricingService } from "../sales/sale-pricing.service";
import { SalesService } from "../sales/sales.service";
import type { CreatePosSaleDto } from "./dto";
import { POS_CATALOG_LIMIT } from "./pos.constants";
import {
  ONLINE_POS_PAYMENT_METHODS,
  POS_DEFAULT_PAYMENT_METHOD,
  type PosCheckoutTotals,
  type PosPaymentMethod,
} from "./types/pos.type";

/** One sellable row: the product itself, or one of its variants. */
interface PosCatalogRow {
  id: string;
  name: string;
  sku: string | null;
  priceMinor: number;
  stockQuantity: number;
  unit: string;
  variantId: string | null;
  variantName: string | null;
  /**
   * The product is tracked unit by unit, so the till must name each serial it is
   * selling. Derived from registered serials rather than a flag on the product:
   * a product becomes serialised the moment its first serial is booked in.
   */
  isSerialized: boolean;
}

@Injectable()
export class PosService {
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    private readonly sales: SalesService,
    private readonly pricing: SalePricingService,
    private readonly money: MoneyPolicyService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Catalog for the terminal grid, one row per thing a cashier can actually sell:
   * a row per variant where a product has them, otherwise one row for the
   * product itself. Prices are re-read at checkout, so a stale cached price can
   * never become the recorded selling price.
   */
  async getCatalogProducts(organizationId: string): Promise<PosCatalogRow[]> {
    const products = await this.db
      .select({
        id: product.id,
        name: product.name,
        sku: product.sku,
        priceMinor: product.priceMinor,
        unit: product.unit,
        // Display total across warehouses; the sale still draws down one warehouse.
        stockQuantity: totalOnHandSql(organizationId),
      })
      .from(product)
      .where(and(eq(product.organizationId, organizationId), eq(product.isActive, true)))
      .limit(POS_CATALOG_LIMIT);

    const variants = await this.db
      .select({
        id: productVariant.id,
        productId: productVariant.productId,
        name: productVariant.name,
        sku: productVariant.sku,
        priceMinor: productVariant.priceMinor,
        onHand: sql<number>`(${totalOnHandForVariantSql(organizationId)})`,
      })
      .from(productVariant)
      .where(
        and(eq(productVariant.organizationId, organizationId), eq(productVariant.isActive, true)),
      )
      .limit(POS_CATALOG_LIMIT);

    const byProduct = new Map<string, typeof variants>();
    for (const variant of variants) {
      const existing = byProduct.get(variant.productId);
      if (existing) existing.push(variant);
      else byProduct.set(variant.productId, [variant]);
    }

    // One query for the whole catalog rather than a count per row, so the grid
    // stays a fixed number of round trips however many products there are.
    const serialized = await this.db
      .selectDistinct({ productId: serialNumber.productId })
      .from(serialNumber)
      .where(eq(serialNumber.organizationId, organizationId));
    const isSerialized = new Set(serialized.map((row) => row.productId));

    return products.flatMap<PosCatalogRow>((row) => {
      const productVariants = byProduct.get(row.id);
      const serializedProduct = isSerialized.has(row.id);
      // A product with variants sells as its variants; showing the parent row as
      // well would offer a line the till cannot decrement.
      if (!productVariants || productVariants.length === 0) {
        return [
          {
            ...row,
            variantId: null,
            variantName: null,
            sku: row.sku,
            isSerialized: serializedProduct,
          },
        ];
      }
      return productVariants.map((variant) => ({
        ...row,
        id: row.id,
        name: `${row.name} · ${variant.name}`,
        sku: variant.sku ?? row.sku,
        priceMinor: variant.priceMinor || row.priceMinor,
        stockQuantity: Number(variant.onHand ?? 0),
        variantId: variant.id,
        variantName: variant.name,
        isSerialized: serializedProduct,
      }));
    });
  }

  async createPosSale(organizationId: string, userId: string | null, input: CreatePosSaleDto) {
    try {
      return await this.recordSale(organizationId, userId, input);
    } catch (reason) {
      /*
       * A queued offline sale can arrive days later, when the stock it wanted is
       * gone or the price moved. A toast on the till is not a record: by the time
       * anyone reads it the seller may have closed up. The audit log is the
       * durable place, and it is explicitly meant to hold "tried and refused".
       */
      if (input.clientReference) {
        await this.audit.record(
          organizationId,
          { userId },
          {
            action: "pos.replay_rejected",
            entityType: "pos_sale",
            entityId: input.clientReference,
            metadata: { reason: reason instanceof Error ? reason.message : String(reason) },
          },
        );
      }
      throw reason;
    }
  }

  private async recordSale(organizationId: string, userId: string | null, input: CreatePosSaleDto) {
    const tenderedMinor = input.tenderedMinor ?? 0;
    const method = input.paymentMethod ?? POS_DEFAULT_PAYMENT_METHOD;

    // Priced and totalled here only to know the change due and whether the sale is
    // settled. The figures recorded on the Order are decided by the sale seams, so
    // the till cannot disagree with the books about what it just took.
    const lines = await this.pricing.priceLines(organizationId, input.items);
    const money = await this.money.orderTotals(organizationId, lines, input.discountMinor ?? 0);
    const settled = this.isSettled(method, tenderedMinor, money.totalMinor);
    const totals: PosCheckoutTotals = {
      ...money,
      changeMinor: Math.max(0, tenderedMinor - money.totalMinor),
    };

    const sale = await this.sales.createSale(organizationId, userId, {
      source: "pos",
      customerId: input.customerId,
      items: lines,
      discountMinor: money.discountMinor,
      paymentAmountMinor: settled ? money.totalMinor : 0,
      paymentMethod: method,
      paymentProvider: settled ? method : undefined,
      paymentReference: input.paymentReference,
      clientReference: input.clientReference,
      notes: input.notes,
    });

    return { ...sale, posTotals: totals };
  }

  /**
   * Card and bank transfers settle online, so they stay unpaid until the provider
   * confirms. Cash at the counter settles immediately.
   */
  private isSettled(method: PosPaymentMethod, tenderedMinor: number, totalMinor: number): boolean {
    if (ONLINE_POS_PAYMENT_METHODS.has(method)) return false;
    return tenderedMinor >= totalMinor;
  }

  }
