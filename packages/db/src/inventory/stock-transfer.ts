import { index, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createOrgScopedColumns } from "../org-scoped-columns";
import { product } from "../products/product";
import { productVariant } from "./product-variant";
import { warehouse } from "./warehouse";

export const TRANSFER_STATUSES = ["draft", "in_transit", "received", "cancelled"] as const;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

/**
 * Moving stock between warehouses is two movements, not one: stock leaves the
 * source now and arrives at the destination when it is received. Until then it
 * sits in transit, so neither warehouse shows it.
 */
export const stockTransfer = pgTable(
  "stock_transfer",
  {
    ...createOrgScopedColumns(),
    reference: text("reference").notNull(),
    fromWarehouseId: uuid("from_warehouse_id")
      .notNull()
      .references(() => warehouse.id),
    toWarehouseId: uuid("to_warehouse_id")
      .notNull()
      .references(() => warehouse.id),
    status: text("status").$type<TransferStatus>().notNull().default("draft"),
    notes: text("notes"),
    dispatchedAt: timestamp("dispatched_at"),
    receivedAt: timestamp("received_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("stock_transfer_organization_id_idx").on(t.organizationId),
    index("stock_transfer_organization_id_status_idx").on(t.organizationId, t.status),
    uniqueIndex("stock_transfer_organization_id_reference_uidx").on(t.organizationId, t.reference),
  ],
);

export const stockTransferItem = pgTable(
  "stock_transfer_item",
  {
    ...createOrgScopedColumns(),
    transferId: uuid("transfer_id")
      .notNull()
      .references(() => stockTransfer.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariant.id, { onDelete: "cascade" }),
    quantity: numeric("quantity", { precision: 15, scale: 3, mode: "number" }).notNull(),
  },
  (t) => [
    index("stock_transfer_item_transfer_id_idx").on(t.transferId),
    index("stock_transfer_item_product_id_idx").on(t.productId),
  ],
);
