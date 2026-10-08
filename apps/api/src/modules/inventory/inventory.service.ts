import { StockService } from "./stock.service";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, sql } from "@nomidat/db";
import { product } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import type { AdjustStockDto, CreateProductDto, UpdateProductDto } from "./dto";

const MAX_LIMIT = 50;

@Injectable()
export class InventoryService {
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    private readonly stock: StockService,
  ) {}

  async getProducts(organizationId: string, limit = 20, offset = 0) {
    const rows = await this.db
      .select({
        id: product.id,
        name: product.name,
        sku: product.sku,
        description: product.description,
        priceMinor: product.priceMinor,
        costMinor: product.costMinor,
        lowStockThreshold: product.lowStockThreshold,
        unit: product.unit,
        isActive: product.isActive,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      })
      .from(product)
      .where(eq(product.organizationId, organizationId))
      .orderBy(desc(product.updatedAt))
      .limit(Math.min(Math.max(limit, 1), MAX_LIMIT))
      .offset(Math.max(0, offset));

    // Display-only total across warehouses; stock rows stay the source of truth.
    const totals = await this.stock.totalOnHand(
      organizationId,
      rows.map((row) => row.id),
    );
    return rows.map((row) => ({ ...row, stockQuantity: totals.get(row.id) ?? 0 }));
  }

  async getProduct(organizationId: string, productId: string) {
    const [item] = await this.db
      .select()
      .from(product)
      .where(and(eq(product.id, productId), eq(product.organizationId, organizationId)))
      .limit(1);

    if (!item) throw new NotFoundException("Product not found.");

    const totals = await this.stock.totalOnHand(organizationId, [productId]);
    return { ...item, stockQuantity: totals.get(productId) ?? 0 };
  }

  async createProduct(organizationId: string, input: CreateProductDto) {
    const name = input.name.trim();
    if (!name) throw new BadRequestException("Product name is required.");

    const sku = input.sku?.trim() || null;
    if (sku) await this.ensureSkuAvailable(organizationId, sku);

    const [created] = await this.db
      .insert(product)
      .values({
        organizationId,
        name,
        sku,
        description: input.description?.trim() || null,
        priceMinor: input.priceMinor,
        costMinor: input.costMinor ?? 0,
        lowStockThreshold: input.lowStockThreshold ?? 5,
        unit: input.unit?.trim() || "pcs",
      })
      .returning();

    // Opening stock is a recorded movement, not a column value.
    if (input.stockQuantity && input.stockQuantity > 0) {
      const warehouseId = await this.stock.resolveDefaultWarehouseId(organizationId);
      await this.stock.recordMovement(organizationId, {
        productId: created.id,
        warehouseId,
        quantity: input.stockQuantity,
        type: "inbound_receive",
        referenceType: "product",
        notes: "Opening stock",
      });
    }

    return { ...created, stockQuantity: input.stockQuantity ?? 0 };
  }

  async updateProduct(organizationId: string, productId: string, input: UpdateProductDto) {
    const existing = await this.getProduct(organizationId, productId);
    const sku = input.sku === undefined ? existing.sku : input.sku.trim() || null;
    if (sku && sku !== existing.sku) await this.ensureSkuAvailable(organizationId, sku, productId);

    const [updated] = await this.db
      .update(product)
      .set({
        isActive: input.isActive ?? existing.isActive,
        name: input.name?.trim() ?? existing.name,
        sku,
        description: input.description?.trim() ?? existing.description,
        priceMinor: input.priceMinor ?? existing.priceMinor,
        costMinor: input.costMinor ?? existing.costMinor,
        lowStockThreshold: input.lowStockThreshold ?? existing.lowStockThreshold,
        unit: input.unit?.trim() ?? existing.unit,
        updatedAt: new Date(),
      })
      .where(and(eq(product.id, productId), eq(product.organizationId, organizationId)))
      .returning();

    return updated;
  }

  async archiveProduct(organizationId: string, productId: string) {
    await this.getProduct(organizationId, productId);

    const [updated] = await this.db
      .update(product)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(product.id, productId), eq(product.organizationId, organizationId)))
      .returning();

    return updated;
  }

  async adjustStock(organizationId: string, productId: string, input: AdjustStockDto) {
    if (input.quantity === 0) {
      throw new BadRequestException("Stock adjustment cannot be zero.");
    }

    await this.getProduct(organizationId, productId);
    const warehouseId = await this.stock.resolveDefaultWarehouseId(organizationId);

    const movement = await this.stock.recordMovement(organizationId, {
      productId,
      warehouseId,
      quantity: input.quantity,
      type: input.quantity > 0 ? "adjustment_add" : "adjustment_remove",
      referenceType: "adjustment",
      notes: input.reason,
    });

    return { ...movement, adjustmentQuantity: input.quantity, reason: input.reason };
  }

  private async ensureSkuAvailable(organizationId: string, sku: string, productId?: string) {
    const [existing] = await this.db
      .select({ id: product.id })
      .from(product)
      .where(
        productId
          ? and(
              eq(product.organizationId, organizationId),
              eq(product.sku, sku),
              sql`${product.id} <> ${productId}`,
            )
          : and(eq(product.organizationId, organizationId), eq(product.sku, sku)),
      )
      .limit(1);

    if (existing) throw new ConflictException("A product with this SKU already exists.");
  }
}
