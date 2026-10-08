import { Inject, Injectable } from "@nestjs/common";
import { and, count, eq, sql } from "@nomidat/db";
import { product } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { lowStockFilter, outOfStockFilter, totalOnHandSql } from "../inventory/stock-levels";

const LOW_STOCK_LIST_LIMIT = 50;

@Injectable()
export class InventoryHealthService {
  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}

  async getInventoryHealth(organizationId: string) {
    const [totals, lowStock, inventoryValueMinor] = await Promise.all([
      this.getInventoryTotals(organizationId),
      this.getLowStockProducts(organizationId),
      this.getInventoryValue(organizationId),
    ]);
    return {
      ...totals,
      inventoryValueMinor,
      lowStock,
    };
  }

  private async getInventoryTotals(organizationId: string) {
    const [row] = await this.db
      .select({
        productCount: count(),
        lowStockCount: sql<number>`count(*) filter (where ${lowStockFilter(organizationId)})`,
        outOfStockCount: sql<number>`count(*) filter (where ${outOfStockFilter(organizationId)})`,
      })
      .from(product)
      .where(eq(product.organizationId, organizationId));
    return {
      productCount: Number(row?.productCount ?? 0),
      lowStockCount: Number(row?.lowStockCount ?? 0),
      outOfStockCount: Number(row?.outOfStockCount ?? 0),
    };
  }

  private async getLowStockProducts(organizationId: string) {
    return this.db
      .select({
        id: product.id,
        name: product.name,
        stockQuantity: totalOnHandSql(organizationId),
        lowStockThreshold: product.lowStockThreshold,
        unit: product.unit,
      })
      .from(product)
      .where(and(eq(product.organizationId, organizationId), lowStockFilter(organizationId)))
      .orderBy(totalOnHandSql(organizationId))
      .limit(LOW_STOCK_LIST_LIMIT);
  }

  private async getInventoryValue(organizationId: string): Promise<number> {
    const [value] = await this.db
      .select({
        totalMinor: sql<number>`coalesce(sum(${totalOnHandSql(organizationId)} * ${product.costMinor}), 0)`,
      })
      .from(product)
      .where(eq(product.organizationId, organizationId));

    return Number(value?.totalMinor ?? 0);
  }
}
