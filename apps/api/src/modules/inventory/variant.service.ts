import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq } from "@nomidat/db";
import { product, productVariant } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import type { CreateVariantDto, UpdateVariantDto } from "./dto/variant.dto";

/** A sellable option of a product: a size, flavour or pack count. */
@Injectable()
export class VariantService {
  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}

  async list(organizationId: string, productId: string) {
    await this.assertProduct(organizationId, productId);
    return this.db
      .select()
      .from(productVariant)
      .where(
        and(
          eq(productVariant.organizationId, organizationId),
          eq(productVariant.productId, productId),
        ),
      )
      .orderBy(asc(productVariant.name));
  }

  async create(organizationId: string, productId: string, input: CreateVariantDto) {
    await this.assertProduct(organizationId, productId);

    const sku = input.sku?.trim() || null;
    if (sku) await this.assertSkuFree(organizationId, sku);

    const [created] = await this.db
      .insert(productVariant)
      .values({
        organizationId,
        productId,
        name: input.name.trim(),
        sku,
        barcode: input.barcode?.trim() || null,
        priceMinor: input.priceMinor,
        costMinor: input.costMinor ?? 0,
      })
      .returning();
    return created;
  }

  async update(
    organizationId: string,
    productId: string,
    variantId: string,
    input: UpdateVariantDto,
  ) {
    const existing = await this.get(organizationId, productId, variantId);

    const sku = input.sku === undefined ? existing.sku : input.sku.trim() || null;
    if (sku && sku !== existing.sku) await this.assertSkuFree(organizationId, sku, variantId);

    const [updated] = await this.db
      .update(productVariant)
      .set({
        name: input.name?.trim() ?? existing.name,
        sku,
        barcode: input.barcode === undefined ? existing.barcode : input.barcode.trim() || null,
        priceMinor: input.priceMinor ?? existing.priceMinor,
        costMinor: input.costMinor ?? existing.costMinor,
        isActive: input.isActive ?? existing.isActive,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(productVariant.id, variantId),
          eq(productVariant.organizationId, organizationId),
        ),
      )
      .returning();
    return updated;
  }

  private async get(organizationId: string, productId: string, variantId: string) {
    const [variant] = await this.db
      .select()
      .from(productVariant)
      .where(
        and(
          eq(productVariant.id, variantId),
          eq(productVariant.organizationId, organizationId),
          eq(productVariant.productId, productId),
        ),
      )
      .limit(1);

    if (!variant) throw new NotFoundException("Variant not found.");
    return variant;
  }

  private async assertProduct(organizationId: string, productId: string) {
    const [found] = await this.db
      .select({ id: product.id })
      .from(product)
      .where(and(eq(product.id, productId), eq(product.organizationId, organizationId)))
      .limit(1);
    if (!found) throw new NotFoundException("Product not found.");
  }

  private async assertSkuFree(organizationId: string, sku: string, variantId?: string) {
    const conditions = [
      eq(productVariant.organizationId, organizationId),
      eq(productVariant.sku, sku),
    ];
    if (variantId) conditions.push(eq(productVariant.id, variantId));

    const [existing] = await this.db
      .select({ id: productVariant.id })
      .from(productVariant)
      .where(and(...conditions))
      .limit(1);

    if (existing) throw new ConflictException(`A variant with SKU "${sku}" already exists.`);
  }
}
