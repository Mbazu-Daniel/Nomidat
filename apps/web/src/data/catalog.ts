import { createApiRequest } from "@/lib/api";

const base = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}`;

/** One page of the catalog. Matches the API's own maximum page size. */
const PRODUCT_PAGE_SIZE = 50;

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  parentCategoryId: string | null;
  isActive: boolean;
}

export interface UnitOfMeasure {
  id: string;
  name: string;
  code: string;
  category: string;
  precision: number;
}

export interface UnitConversion {
  id: string;
  fromUnitId: string;
  toUnitId: string;
  factor: number;
}

export interface Supplier {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  priceMinor: number;
  costMinor: number;
  lowStockThreshold: number;
  unit: string;
  isActive: boolean;
  /** Display total across warehouses. Never written to; a Stock Movement is how stock changes. */
  stockQuantity: number;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  priceMinor: number;
  costMinor: number;
  isDefault: boolean;
  isActive: boolean;
}

export const getProducts = (organizationId: string) =>
  createApiRequest<Product[]>(`${base(organizationId)}/products?limit=50`);

/**
 * Every product in the business, page by page.
 *
 * A product picker needs the whole list, not the first page: the seller is
 * matching a photographed item against something they half remember, and a list
 * that silently stops at fifty cannot be searched.
 */
export async function getOrganizationProducts(organizationId: string) {
  const all: Product[] = [];
  for (let offset = 0; ; offset += PRODUCT_PAGE_SIZE) {
    const page = await createApiRequest<Product[]>(
      `${base(organizationId)}/products?limit=${PRODUCT_PAGE_SIZE}&offset=${offset}`,
    );
    all.push(...page);
    if (page.length < PRODUCT_PAGE_SIZE) return all;
  }
}

/**
 * Archiving goes through the product editor's own PATCH rather than the API's
 * DELETE route, because that one toggle covers both directions and a second way
 * to archive is a second thing to keep in step.
 */
export const getCategories = (organizationId: string) =>
  createApiRequest<ProductCategory[]>(`${base(organizationId)}/product-categories`);

export const createCategory = (organizationId: string, body: Record<string, unknown>) =>
  createApiRequest<ProductCategory>(`${base(organizationId)}/product-categories`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateCategory = (
  organizationId: string,
  categoryId: string,
  body: Record<string, unknown>,
) =>
  createApiRequest<ProductCategory>(
    `${base(organizationId)}/product-categories/${encodeURIComponent(categoryId)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );

export const deleteCategory = (organizationId: string, categoryId: string) =>
  createApiRequest<{ id: string }>(
    `${base(organizationId)}/product-categories/${encodeURIComponent(categoryId)}`,
    { method: "DELETE" },
  );

/**
 * Replaces the product's categories outright, so the caller must send the whole
 * set — which is why the current assignment is read first.
 */
export const getProductCategories = (organizationId: string, productId: string) =>
  createApiRequest<ProductCategory[]>(
    `${base(organizationId)}/products/${encodeURIComponent(productId)}/categories`,
  );

export const setProductCategories = (
  organizationId: string,
  productId: string,
  categoryIds: string[],
) =>
  createApiRequest<ProductCategory[]>(
    `${base(organizationId)}/products/${encodeURIComponent(productId)}/categories`,
    { method: "POST", body: JSON.stringify({ categoryIds }) },
  );

export const getUnits = (organizationId: string) =>
  createApiRequest<UnitOfMeasure[]>(`${base(organizationId)}/units`);

export const createUnit = (organizationId: string, body: Record<string, unknown>) =>
  createApiRequest<UnitOfMeasure>(`${base(organizationId)}/units`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateUnit = (organizationId: string, unitId: string, body: Record<string, unknown>) =>
  createApiRequest<UnitOfMeasure>(`${base(organizationId)}/units/${encodeURIComponent(unitId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

/** A factor belongs to the pair of units, which is why these are their own resource. */
export const getUnitConversions = (organizationId: string) =>
  createApiRequest<UnitConversion[]>(`${base(organizationId)}/unit-conversions`);

export const createUnitConversion = (organizationId: string, body: Record<string, unknown>) =>
  createApiRequest<UnitConversion>(`${base(organizationId)}/unit-conversions`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const getSuppliers = (organizationId: string) =>
  createApiRequest<Supplier[]>(`${base(organizationId)}/suppliers`);

export const createSupplier = (organizationId: string, body: Record<string, unknown>) =>
  createApiRequest<Supplier>(`${base(organizationId)}/suppliers`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateSupplier = (
  organizationId: string,
  supplierId: string,
  body: Record<string, unknown>,
) =>
  createApiRequest<Supplier>(
    `${base(organizationId)}/suppliers/${encodeURIComponent(supplierId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(body),
    },
  );

export const getProductVariants = (organizationId: string, productId: string) =>
  createApiRequest<ProductVariant[]>(
    `${base(organizationId)}/products/${encodeURIComponent(productId)}/variants`,
  );

export const createProductVariant = (
  organizationId: string,
  productId: string,
  body: Record<string, unknown>,
) =>
  createApiRequest<ProductVariant>(
    `${base(organizationId)}/products/${encodeURIComponent(productId)}/variants`,
    { method: "POST", body: JSON.stringify(body) },
  );

export const updateProductVariant = (
  organizationId: string,
  productId: string,
  variantId: string,
  body: Record<string, unknown>,
) =>
  createApiRequest<ProductVariant>(
    `${base(organizationId)}/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
