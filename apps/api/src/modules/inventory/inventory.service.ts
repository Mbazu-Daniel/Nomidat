import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, desc, eq, gte, sql } from "@nomidat/db";
import { product } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import type { AdjustStockDto, CreateProductDto, UpdateProductDto } from "./dto";

const MAX_LIMIT = 50;

@Injectable()
export class InventoryService {
  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}

  async listProducts(organizationId: string, limit = 20) {
    return this.db.db
      .select({
        id: product.id,
        name: product.name,
        sku: product.sku,
        description: product.description,
        priceKobo: product.priceKobo,
        costKobo: product.costKobo,
        stockQuantity: product.stockQuantity,
        lowStockThreshold: product.lowStockThreshold,
        unit: product.unit,
        isActive: product.isActive,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      })
      .from(product)
      .where(eq(product.organizationId, organizationId))
      .orderBy(desc(product.updatedAt))
      .limit(Math.min(Math.max(limit, 1), MAX_LIMIT));
  }

  async getProduct(organizationId: string, productId: string) {
    const [item] = await this.db.db
      .select()
      .from(product)
      .where(and(eq(product.id, productId), eq(product.organizationId, organizationId)))
      .limit(1);

    if (!item) throw new NotFoundException("Product not found.");
    return item;
  }

  async createProduct(organizationId: string, input: CreateProductDto) {
    const name = input.name.trim();
    if (!name) throw new BadRequestException("Product name is required.");

    const sku = input.sku?.trim() || null;
    if (sku) await this.ensureSkuAvailable(organizationId, sku);

    const [created] = await this.db.db
      .insert(product)
      .values({
        organizationId,
        name,
        sku,
        description: input.description?.trim() || null,
        priceKobo: input.priceKobo,
        costKobo: input.costKobo ?? 0,
        stockQuantity: input.stockQuantity ?? 0,
        lowStockThreshold: input.lowStockThreshold ?? 5,
        unit: input.unit?.trim() || "pcs",
      })
      .returning();

    return created;
  }

  async updateProduct(organizationId: string, productId: string, input: UpdateProductDto) {
    const existing = await this.getProduct(organizationId, productId);
    const sku = input.sku === undefined ? existing.sku : input.sku.trim() || null;

    if (sku && sku !== existing.sku) await this.ensureSkuAvailable(organizationId, sku, productId);

    const [updated] = await this.db.db
      .update(product)
      .set({
        name: input.name === undefined ? existing.name : input.name.trim(),
        sku,
        description:
          input.description === undefined ? existing.description : input.description.trim() || null,
        priceKobo: input.priceKobo ?? existing.priceKobo,
        costKobo: input.costKobo ?? existing.costKobo,
        lowStockThreshold: input.lowStockThreshold ?? existing.lowStockThreshold,
        unit: input.unit === undefined ? existing.unit : input.unit.trim() || existing.unit,
        updatedAt: new Date(),
      })
      .where(and(eq(product.id, productId), eq(product.organizationId, organizationId)))
      .returning();

    return updated;
  }

  async archiveProduct(organizationId: string, productId: string) {
    await this.getProduct(organizationId, productId);

    const [updated] = await this.db.db
      .update(product)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(product.id, productId), eq(product.organizationId, organizationId)))
      .returning();

    return updated;
  }

  async adjustStock(
    organizationId: string,
    productId: string,
    input: AdjustStockDto,
  ) {
    if (input.quantity === 0) {
      throw new BadRequestException("Stock adjustment cannot be zero.");
    }

    return this.db.db.transaction(async (tx) => {
      const [current] = await tx
        .select({ id: product.id, name: product.name, stockQuantity: product.stockQuantity })
        .from(product)
        .where(and(eq(product.id, productId), eq(product.organizationId, organizationId)))
        .for("update")
        .limit(1);

      if (!current) throw new NotFoundException("Product not found.");

      const nextStock = current.stockQuantity + input.quantity;
      if (nextStock < 0) {
        throw new ConflictException(
          `Stock cannot go below zero for ${current.name}. Available stock: ${current.stockQuantity}.`,
        );
      }

      const [updated] = await tx
        .update(product)
        .set({ stockQuantity: sql`${product.stockQuantity} + ${input.quantity}`, updatedAt: new Date() })
        .where(
          and(
            eq(product.id, productId),
            eq(product.organizationId, organizationId),
            gte(product.stockQuantity, -input.quantity),
          ),
        )
        .returning();

      if (!updated) throw new ConflictException("Stock changed while applying the adjustment.");

      return { ...updated, adjustmentQuantity: input.quantity, reason: input.reason };
    });
  }

  private async ensureSkuAvailable(organizationId: string, sku: string, productId?: string) {
    const [existing] = await this.db.db
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
