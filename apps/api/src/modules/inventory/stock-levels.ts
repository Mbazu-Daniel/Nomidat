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

export function lowStockFilter(organizationId: unknown) {
  return sql<boolean>`${totalOnHandSql(organizationId)} <= ${product.lowStockThreshold}`;
}

export function outOfStockFilter(organizationId: unknown) {
  return sql<boolean>`${totalOnHandSql(organizationId)} <= 0`;
}
