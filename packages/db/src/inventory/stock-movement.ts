import { index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createOrgScopedColumns } from "../org-scoped-columns";
import { product } from "../products/product";
import { batch } from "./batch";
import { productVariant } from "./product-variant";
import { warehouse } from "./warehouse";

/**
 * Why a Stock Movement happened. Mirrors the source system's movement types.
 *
 * This list is also a database CHECK constraint (`stock_movement_type_chk`):
 * `StockService` only applies the never-negative rule to the three decreasing
 * types, so a movement arriving with an unrecognised type would skip that check
 * entirely and could drive a Stock Level negative while still reading as an
 * ordinary sale. Adding a type here means adding it to that constraint too.
 */
export const STOCK_MOVEMENT_TYPES = [
  "inbound_receive",
  "outbound_ship",
  "transfer_out",
  "transfer_in",
  "adjustment_add",
  "adjustment_remove",
  "return_in",
  "cycle_count_correction",
] as const;

export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

/**
 * The documents a Stock Movement can point back to. Mirrors the closed set the
 * `stock_movement_reference_type_chk` CHECK constraint accepts.
 *
 * A movement with a NULL provenance is a plain count, which the constraint allows;
 * one with an unrecognised value is a typo, which it refuses. Declared here so the
 * invariant test reads the real list instead of a copy that drifts: every
 * Stock Movement the code writes must appear here, and every value here must be one
 * the database accepts.
 */
export const STOCK_MOVEMENT_REFERENCE_TYPES = [
  "order",
  "purchase_order",
  "stock_transfer",
  "stock_return",
  "adjustment",
  "cycle_count",
  "batch",
  "product",
  "serial_number",
] as const;

export type StockMovementReferenceType = (typeof STOCK_MOVEMENT_REFERENCE_TYPES)[number];

/**
 * Immutable ledger of every stock change. Rows are never updated or deleted; a
 * correction is recorded as another movement so the history stays explainable.
 */
export const stockMovement = pgTable(
  "stock_movement",
  {
    ...createOrgScopedColumns(),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariant.id, { onDelete: "cascade" }),
    /** The batch this movement drew from, when the product is batch-tracked. */
    batchId: uuid("batch_id").references(() => batch.id, { onDelete: "restrict" }),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouse.id, { onDelete: "cascade" }),
    type: text("type").$type<StockMovementType>().notNull(),
    /** Signed: negative removes stock, positive adds it. */
    quantity: numeric("quantity", { precision: 15, scale: 3, mode: "number" }).notNull(),
    previousBalance: numeric("previous_balance", {
      precision: 15,
      scale: 3,
      mode: "number",
    }).notNull(),
    newBalance: numeric("new_balance", { precision: 15, scale: 3, mode: "number" }).notNull(),
    /** The order, purchase or transfer that caused this movement, when there is one. */
    referenceId: uuid("reference_id"),
    /**
     * What caused the movement: an order, a purchase order, a transfer, and so
     * on. Constrained by `stock_movement_reference_type_chk` to the closed set the
     * code writes, because an unrecognised value is indistinguishable from a real
     * category when someone later asks which transfers touched a product. A typo
     * silently voids the ledger's provenance.
     */
    referenceType: text("reference_type"),
    notes: text("notes"),
    createdByUserId: uuid("created_by_user_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("stock_movement_organization_id_idx").on(t.organizationId),
    index("stock_movement_organization_id_product_id_idx").on(t.organizationId, t.productId),
    index("stock_movement_organization_id_warehouse_id_idx").on(t.organizationId, t.warehouseId),
    index("stock_movement_organization_id_created_at_idx").on(t.organizationId, t.createdAt),
    index("stock_movement_reference_id_idx").on(t.referenceId),
  ],
);
