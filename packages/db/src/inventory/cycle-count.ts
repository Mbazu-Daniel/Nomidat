import { index, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createOrgScopedColumns } from "../org-scoped-columns";
import { product } from "../products/product";
import { productVariant } from "./product-variant";
import { warehouse } from "./warehouse";

export const CYCLE_COUNT_STATUSES = ["draft", "counted", "applied"] as const;
export type CycleCountStatus = (typeof CYCLE_COUNT_STATUSES)[number];

/**
 * A physical count of one warehouse. The difference between counted and expected
 * is what a correction should post — the count, never the guess.
 */
export const cycleCount = pgTable(
  "cycle_count",
  {
    ...createOrgScopedColumns(),
    reference: text("reference").notNull(),
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouse.id),
    status: text("status").$type<CycleCountStatus>().notNull().default("draft"),
    notes: text("notes"),
    countedAt: timestamp("counted_at"),
    appliedAt: timestamp("applied_at"),
    createdByUserId: uuid("created_by_user_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("cycle_count_organization_id_idx").on(t.organizationId),
    index("cycle_count_organization_id_status_idx").on(t.organizationId, t.status),
    uniqueIndex("cycle_count_organization_id_reference_uidx").on(t.organizationId, t.reference),
  ],
);

export const cycleCountLine = pgTable(
  "cycle_count_line",
  {
    ...createOrgScopedColumns(),
    cycleCountId: uuid("cycle_count_id")
      .notNull()
      .references(() => cycleCount.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariant.id, { onDelete: "cascade" }),
    /** What the system believed was there when the count started. */
    expectedQuantity: numeric("expected_quantity", {
      precision: 15,
      scale: 3,
      mode: "number",
    }).notNull(),
    /** What the counter physically found. */
    countedQuantity: numeric("counted_quantity", {
      precision: 15,
      scale: 3,
      mode: "number",
    }),
  },
  (t) => [
    index("cycle_count_line_cycle_count_id_idx").on(t.cycleCountId),
    index("cycle_count_line_product_id_idx").on(t.productId),
  ],
);
