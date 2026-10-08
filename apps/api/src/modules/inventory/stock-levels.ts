import { sql } from "@nomidat/db";
import { product, productVariant, stock } from "@nomidat/db/schema";

/**
 * Scalar subquery for a product's total on hand across warehouses, correlated to
 * the surrounding `product` query. Lets reports filter and sort by real stock
 * without a second round trip.
 */
export function totalOnHandSql(organizationId: unknown) {
  return sql<number>`coalesce((select sum(s.on_hand) from ${stock} s where s.organization_id = ${organizationId} and s.product_id = ${product.id}), 0)::int`;
}

/**
 * The same total for one variant, correlated to the surrounding `productVariant`
 * query. A variant is its own Stock Level, so pooling it with the product total
 * would report stock the cashier cannot actually sell.
 */
export function totalOnHandForVariantSql(organizationId: unknown) {
  return sql<number>`coalesce((select sum(s.on_hand) from ${stock} s where s.organization_id = ${organizationId} and s.product_id = ${productVariant.productId} and s.variant_id = ${productVariant.id}), 0)::int`;
}

/**
 * Whether a product is buyable right now, correlated to the surrounding `product`
 * query. Derived from the same sum as `totalOnHandSql`, so a product shown as in
 * stock can never be one whose stock level is empty.
 */
export function inStockSql(organizationId: unknown) {
  return sql<boolean>`${totalOnHandSql(organizationId)} > 0`;
}

/** The same, for one variant, which is its own Stock Level. */
export function variantInStockSql(organizationId: unknown) {
  return sql<boolean>`${totalOnHandForVariantSql(organizationId)} > 0`;
}

export function lowStockFilter(organizationId: unknown) {
  return sql<boolean>`${totalOnHandSql(organizationId)} <= ${product.lowStockThreshold}`;
}

export function outOfStockFilter(organizationId: unknown) {
  return sql<boolean>`${totalOnHandSql(organizationId)} <= 0`;
}
