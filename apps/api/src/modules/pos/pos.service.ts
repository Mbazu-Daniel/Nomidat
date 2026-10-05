import { PosTotalsService } from "./pos-totals.service";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq, inArray, sql } from "@nomidat/db";
import { product, productVariant, serialNumber } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { totalOnHandForVariantSql, totalOnHandSql } from "../inventory/stock-levels";
import { AuditService } from "../audit/audit.service";
import { SalesService } from "../sales/sales.service";
import type { CreatePosSaleDto } from "./dto";
import { POS_CATALOG_LIMIT } from "./pos.constants";
import {
  ONLINE_POS_PAYMENT_METHODS,
  POS_DEFAULT_PAYMENT_METHOD,
  type PosCartLine,
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
    private readonly totals: PosTotalsService,
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
      .where(and(eq(productVariant.organizationId, organizationId), eq(productVariant.isActive, true)))
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
        return [{ ...row, variantId: null, variantName: null, sku: row.sku, isSerialized: serializedProduct }];
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
        await this.audit.record(organizationId, { userId }, {
          action: "pos.replay_rejected",
          entityType: "pos_sale",
          entityId: input.clientReference,
          metadata: { reason: reason instanceof Error ? reason.message : String(reason) },
        });
      }
      throw reason;
    }
  }

  private async recordSale(organizationId: string, userId: string | null, input: CreatePosSaleDto) {
    const lines = await this.priceLines(organizationId, input.items);
    const tenderedMinor = input.tenderedMinor ?? 0;
    const totals = await this.totals.calculate(
      lines,
      input.discountMinor ?? 0,
      tenderedMinor,
      organizationId,
    );
    const method = input.paymentMethod ?? POS_DEFAULT_PAYMENT_METHOD;
    const settled = this.isSettled(method, tenderedMinor, totals.totalMinor);

    const sale = await this.sales.createSale(organizationId, userId, {
      source: "pos",
      customerId: input.customerId,
      items: lines.map((line, index) => ({
        productId: line.productId,
        // The DTO models "no variant" as an absent field, not null.
        variantId: line.variantId ?? undefined,
        quantity: line.quantity,
        unitPriceMinor: line.unitPriceMinor,
        lineTotalMinor: line.quantity * line.unitPriceMinor,
        // The terminal names the exact units; the sale claims them transactionally.
        serialNumberIds: input.items[index]?.serialNumberIds,
      })),
      discountMinor: totals.discountMinor,
      taxMinor: totals.taxMinor,
      paymentAmountMinor: settled ? totals.totalMinor : 0,
      paymentMethod: method,
      paymentProvider: settled ? method : undefined,
      paymentReference: input.paymentReference,
      clientReference: input.clientReference,
      notes: input.notes,
    });

    return { ...sale, posTotals: totals, changeMinor: totals.changeMinor };
  }

  /**
   * Card and bank transfers settle online, so they stay unpaid until the provider
   * confirms. Cash at the counter settles immediately.
   */
  private isSettled(
    method: PosPaymentMethod,
    tenderedMinor: number,
    totalMinor: number,
  ): boolean {
    if (ONLINE_POS_PAYMENT_METHODS.has(method)) return false;
    return tenderedMinor >= totalMinor;
  }

  /** Reads current prices server-side; the terminal only sends product ids. */
  private async priceLines(
    organizationId: string,
    items: CreatePosSaleDto["items"],
  ): Promise<PosCartLine[]> {
    const productIds = [...new Set(items.map((item) => item.productId))];
    const stored = await this.db
      .select({
        id: product.id,
        priceMinor: product.priceMinor,
        isActive: product.isActive,
      })
      .from(product)
      .where(and(eq(product.organizationId, organizationId), inArray(product.id, productIds)));

    const prices = new Map(stored.map((row) => [row.id, row]));

    const variantIds = items.flatMap((item) => (item.variantId ? [item.variantId] : []));
    const storedVariants =
      variantIds.length === 0
        ? []
        : await this.db
            .select({
              id: productVariant.id,
              productId: productVariant.productId,
              priceMinor: productVariant.priceMinor,
              isActive: productVariant.isActive,
            })
            .from(productVariant)
            .where(
              and(
                eq(productVariant.organizationId, organizationId),
                inArray(productVariant.id, variantIds),
              ),
            );
    const variants = new Map(storedVariants.map((row) => [row.id, row]));

    return items.map((item) => {
      const found = prices.get(item.productId);
      if (!found) throw new NotFoundException("Product not found.");
      if (!found.isActive) throw new BadRequestException("Product is archived and cannot be sold.");

      // A variant must belong to the product it was sold under, or a caller could
      // name any variant they like and have its price applied to another product.
      const variant = item.variantId ? variants.get(item.variantId) : undefined;
      if (item.variantId && (!variant || variant.productId !== item.productId)) {
        throw new BadRequestException("That variant does not belong to this product.");
      }
      if (variant && !variant.isActive) {
        throw new BadRequestException("That variant is archived and cannot be sold.");
      }

      return {
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
        unitPriceMinor: variant?.priceMinor || found.priceMinor,
      };
    });
  }
}