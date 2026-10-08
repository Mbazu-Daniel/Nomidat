import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq, inArray } from "@nomidat/db";
import { product, productCategory, productCategoryAssignment, supplier } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import type {
  AssignProductToCategoriesDto,
  CreateProductCategoryDto,
  CreateSupplierDto,
  UpdateProductCategoryDto,
  UpdateSupplierDto,
} from "./dto/catalog.dto";

const MAX_LIMIT = 100;

/** Categories and suppliers: the organising layer around products. */
@Injectable()
export class CatalogService {
  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}

  getCategories(organizationId: string) {
    return this.db
      .select()
      .from(productCategory)
      .where(eq(productCategory.organizationId, organizationId))
      .orderBy(asc(productCategory.sortOrder), asc(productCategory.name));
  }

  async createCategory(organizationId: string, input: CreateProductCategoryDto) {
    await this.assertSlugFree(organizationId, input.slug);
    if (input.parentCategoryId) {
      await this.getCategory(organizationId, input.parentCategoryId);
    }

    const [created] = await this.db
      .insert(productCategory)
      .values({
        organizationId,
        name: input.name.trim(),
        slug: input.slug,
        description: input.description?.trim() || null,
        parentCategoryId: input.parentCategoryId ?? null,
        sortOrder: input.sortOrder ?? 0,
      })
      .returning();
    return created;
  }

  async updateCategory(
    organizationId: string,
    categoryId: string,
    input: UpdateProductCategoryDto,
  ) {
    const existing = await this.getCategory(organizationId, categoryId);

    if (input.parentCategoryId) {
      if (input.parentCategoryId === categoryId) {
        throw new ConflictException("A category cannot be its own parent.");
      }
      await this.getCategory(organizationId, input.parentCategoryId);
    }

    const [updated] = await this.db
      .update(productCategory)
      .set({
        name: input.name?.trim() ?? existing.name,
        description: input.description?.trim() ?? existing.description,
        parentCategoryId:
          input.parentCategoryId === undefined ? existing.parentCategoryId : input.parentCategoryId,
        sortOrder: input.sortOrder ?? existing.sortOrder,
        isActive: input.isActive ?? existing.isActive,
        updatedAt: new Date(),
      })
      .where(
        and(eq(productCategory.id, categoryId), eq(productCategory.organizationId, organizationId)),
      )
      .returning();

    return updated;
  }

  async archiveCategory(organizationId: string, categoryId: string) {
    await this.getCategory(organizationId, categoryId);
    const [updated] = await this.db
      .update(productCategory)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(eq(productCategory.id, categoryId), eq(productCategory.organizationId, organizationId)),
      )
      .returning();
    return updated;
  }

  /** Replaces a product's categories wholesale, so the caller never juggles deltas. */
  async assignProductCategories(
    organizationId: string,
    productId: string,
    input: AssignProductToCategoriesDto,
  ) {
    const [found] = await this.db
      .select({ id: product.id })
      .from(product)
      .where(and(eq(product.id, productId), eq(product.organizationId, organizationId)))
      .limit(1);
    if (!found) throw new NotFoundException("Product not found.");

    const uniqueIds = [...new Set(input.categoryIds)];
    if (uniqueIds.length) {
      const known = await this.db
        .select({ id: productCategory.id })
        .from(productCategory)
        .where(
          and(
            eq(productCategory.organizationId, organizationId),
            inArray(productCategory.id, uniqueIds),
          ),
        );
      if (known.length !== uniqueIds.length) {
        throw new NotFoundException("One or more categories were not found.");
      }
    }

    await this.db
      .delete(productCategoryAssignment)
      .where(
        and(
          eq(productCategoryAssignment.organizationId, organizationId),
          eq(productCategoryAssignment.productId, productId),
        ),
      );

    if (uniqueIds.length) {
      await this.db
        .insert(productCategoryAssignment)
        .values(uniqueIds.map((categoryId) => ({ organizationId, productId, categoryId })));
    }

    return this.getProductCategoryIds(organizationId, productId);
  }

  /**
   * The categories a product currently sits in. Exposed so the assignment screen
   * can show what is already set: without it, replacing the set is something the
   * seller can only do blind.
   */
  async getProductCategories(organizationId: string, productId: string) {
    return this.db
      .select({
        id: productCategory.id,
        name: productCategory.name,
        slug: productCategory.slug,
        parentCategoryId: productCategory.parentCategoryId,
        isActive: productCategory.isActive,
      })
      .from(productCategoryAssignment)
      .innerJoin(productCategory, eq(productCategory.id, productCategoryAssignment.categoryId))
      .where(
        and(
          eq(productCategoryAssignment.organizationId, organizationId),
          eq(productCategoryAssignment.productId, productId),
        ),
      )
      .orderBy(asc(productCategory.name));
  }

  getProductCategoryIds(organizationId: string, productId: string) {
    return this.db
      .select({ categoryId: productCategoryAssignment.categoryId })
      .from(productCategoryAssignment)
      .where(
        and(
          eq(productCategoryAssignment.organizationId, organizationId),
          eq(productCategoryAssignment.productId, productId),
        ),
      );
  }

  getSuppliers(organizationId: string, limit = 50) {
    return this.db
      .select()
      .from(supplier)
      .where(and(eq(supplier.organizationId, organizationId), eq(supplier.isActive, true)))
      .orderBy(asc(supplier.name))
      .limit(Math.min(Math.max(limit, 1), MAX_LIMIT));
  }

  async createSupplier(organizationId: string, input: CreateSupplierDto) {
    const name = input.name.trim();
    if (!name) throw new ConflictException("Supplier name is required.");

    const [created] = await this.db
      .insert(supplier)
      .values({
        organizationId,
        name,
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        address: input.address?.trim() || null,
        notes: input.notes?.trim() || null,
      })
      .returning();
    return created;
  }

  async updateSupplier(organizationId: string, supplierId: string, input: UpdateSupplierDto) {
    const [existing] = await this.db
      .select()
      .from(supplier)
      .where(and(eq(supplier.id, supplierId), eq(supplier.organizationId, organizationId)))
      .limit(1);
    if (!existing) throw new NotFoundException("Supplier not found.");

    const [updated] = await this.db
      .update(supplier)
      .set({
        name: input.name?.trim() ?? existing.name,
        email: input.email === undefined ? existing.email : input.email.trim() || null,
        phone: input.phone === undefined ? existing.phone : input.phone.trim() || null,
        address: input.address === undefined ? existing.address : input.address.trim() || null,
        notes: input.notes === undefined ? existing.notes : input.notes.trim() || null,
        isActive: input.isActive ?? existing.isActive,
        updatedAt: new Date(),
      })
      .where(and(eq(supplier.id, supplierId), eq(supplier.organizationId, organizationId)))
      .returning();

    return updated;
  }

  private async getCategory(organizationId: string, categoryId: string) {
    const [category] = await this.db
      .select()
      .from(productCategory)
      .where(
        and(eq(productCategory.id, categoryId), eq(productCategory.organizationId, organizationId)),
      )
      .limit(1);

    if (!category) throw new NotFoundException("Category not found.");
    return category;
  }

  private async assertSlugFree(organizationId: string, slug: string) {
    const [existing] = await this.db
      .select({ id: productCategory.id })
      .from(productCategory)
      .where(
        and(eq(productCategory.organizationId, organizationId), eq(productCategory.slug, slug)),
      )
      .limit(1);

    if (existing) throw new ConflictException(`Category slug "${slug}" is already in use.`);
  }
}
