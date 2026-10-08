import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, desc, eq } from "@nomidat/db";
import { product, stock, stockMovement, warehouse } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import type { CreateWarehouseDto, UpdateWarehouseDto } from "./dto/warehouse.dto";

const MAX_LIMIT = 100;

/** Warehouses, and the read side of stock: levels and the movement ledger. */
@Injectable()
export class WarehouseService {
  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}

  getWarehouses(organizationId: string) {
    return this.db
      .select()
      .from(warehouse)
      .where(and(eq(warehouse.organizationId, organizationId), eq(warehouse.isActive, true)))
      .orderBy(desc(warehouse.isDefault), asc(warehouse.name));
  }

  async createWarehouse(organizationId: string, input: CreateWarehouseDto) {
    const code = input.code.trim().toUpperCase();
    await this.assertCodeFree(organizationId, code);

    const [created] = await this.db
      .insert(warehouse)
      .values({
        organizationId,
        name: input.name.trim(),
        code,
        kind: input.kind ?? "store",
        address: input.address?.trim() || null,
        phone: input.phone?.trim() || null,
      })
      .returning();
    return created;
  }

  async updateWarehouse(organizationId: string, warehouseId: string, input: UpdateWarehouseDto) {
    const existing = await this.getWarehouse(organizationId, warehouseId);

    const [updated] = await this.db
      .update(warehouse)
      .set({
        name: input.name?.trim() ?? existing.name,
        address: input.address === undefined ? existing.address : input.address.trim() || null,
        phone: input.phone === undefined ? existing.phone : input.phone.trim() || null,
        isActive: input.isActive ?? existing.isActive,
        updatedAt: new Date(),
      })
      .where(and(eq(warehouse.id, warehouseId), eq(warehouse.organizationId, organizationId)))
      .returning();
    return updated;
  }

  getStockLevels(organizationId: string, warehouseId: string | undefined, limit = 50, offset = 0) {
    return this.db
      .select({
        id: stock.id,
        productId: stock.productId,
        productName: product.name,
        sku: product.sku,
        unit: product.unit,
        variantId: stock.variantId,
        onHand: stock.onHand,
        inTransit: stock.inTransit,
      })
      .from(stock)
      .innerJoin(product, eq(product.id, stock.productId))
      .where(
        warehouseId
          ? and(eq(stock.organizationId, organizationId), eq(stock.warehouseId, warehouseId))
          : eq(stock.organizationId, organizationId),
      )
      .orderBy(asc(product.name))
      .limit(Math.min(Math.max(limit, 1), MAX_LIMIT))
      .offset(Math.max(0, offset));
  }

  getMovements(organizationId: string, productId: string | undefined, limit = 50, offset = 0) {
    return this.db
      .select({
        id: stockMovement.id,
        type: stockMovement.type,
        quantity: stockMovement.quantity,
        previousBalance: stockMovement.previousBalance,
        newBalance: stockMovement.newBalance,
        productName: product.name,
        notes: stockMovement.notes,
        referenceType: stockMovement.referenceType,
        createdAt: stockMovement.createdAt,
      })
      .from(stockMovement)
      .innerJoin(product, eq(product.id, stockMovement.productId))
      .where(
        productId
          ? and(
              eq(stockMovement.organizationId, organizationId),
              eq(stockMovement.productId, productId),
            )
          : eq(stockMovement.organizationId, organizationId),
      )
      .orderBy(desc(stockMovement.createdAt))
      .limit(Math.min(Math.max(limit, 1), MAX_LIMIT))
      .offset(Math.max(0, offset));
  }

  private async getWarehouse(organizationId: string, warehouseId: string) {
    const [found] = await this.db
      .select()
      .from(warehouse)
      .where(and(eq(warehouse.id, warehouseId), eq(warehouse.organizationId, organizationId)))
      .limit(1);

    if (!found) throw new NotFoundException("Warehouse not found.");
    return found;
  }

  private async assertCodeFree(organizationId: string, code: string) {
    const [existing] = await this.db
      .select({ id: warehouse.id })
      .from(warehouse)
      .where(and(eq(warehouse.organizationId, organizationId), eq(warehouse.code, code)))
      .limit(1);

    if (existing) throw new ConflictException(`Warehouse code "${code}" is already in use.`);
  }
}
