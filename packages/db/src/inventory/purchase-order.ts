import {
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createMoneyTotalColumns } from "../money-total-columns";
import { createOrgScopedColumns } from "../org-scoped-columns";
import { product } from "../products/product";
import { productVariant } from "./product-variant";
import { supplier } from "./supplier";
import { warehouse } from "./warehouse";

export const PURCHASE_ORDER_STATUSES = [
  "draft",
  "ordered",
  "partial",
  "received",
  "cancelled",
] as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

/** An order placed with a supplier. Receiving it posts inbound stock movements. */
export const purchaseOrder = pgTable(
  "purchase_order",
  {
    ...createOrgScopedColumns(),
    reference: text("reference").notNull(),
    supplierId: uuid("supplier_id").references(() => supplier.id, { onDelete: "set null" }),
    status: text("status").$type<PurchaseOrderStatus>().notNull().default("draft"),
    /**
     * Where the delivery lands. A foreign key alone would still accept another
     * business's warehouse id, so the composite foreign key below ties the pair
     * to one organization: receiving stock then writes a movement into a
     * warehouse this shop does not own.
     */
    warehouseId: uuid("warehouse_id")
      .notNull()
      .references(() => warehouse.id, { onDelete: "restrict" }),
    expectedAt: timestamp("expected_at"),
    orderedAt: timestamp("ordered_at"),
    receivedAt: timestamp("received_at"),
    notes: text("notes"),
    ...createMoneyTotalColumns(),
    createdByUserId: uuid("created_by_user_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("purchase_order_organization_id_idx").on(t.organizationId),
    index("purchase_order_organization_id_status_idx").on(t.organizationId, t.status),
    index("purchase_order_supplier_id_idx").on(t.supplierId),
    uniqueIndex("purchase_order_organization_id_reference_uidx").on(t.organizationId, t.reference),
    /**
     * The warehouse must belong to the same business as the order.
     *
     * A plain foreign key on warehouse_id would accept another tenant's warehouse,
     * and receiving the order would then post a Stock Movement into a warehouse
     * this shop does not own — writing rows into a stranger's inventory. It also
     * answers a question the caller should not be able to ask: passing a guessed
     * id and observing success reveals whether that warehouse exists.
     */
    foreignKey({
      columns: [t.warehouseId, t.organizationId],
      foreignColumns: [warehouse.id, warehouse.organizationId],
      name: "purchase_order_warehouse_organization_fk",
    }).onDelete("restrict"),
  ],
);

export const purchaseOrderItem = pgTable(
  "purchase_order_item",
  {
    ...createOrgScopedColumns(),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => purchaseOrder.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariant.id, { onDelete: "cascade" }),
    quantityOrdered: numeric("quantity_ordered", {
      precision: 15,
      scale: 3,
      mode: "number",
    }).notNull(),
    quantityReceived: numeric("quantity_received", {
      precision: 15,
      scale: 3,
      mode: "number",
    })
      .notNull()
      .default(0),
    unitCostMinor: integer("unit_cost_minor").notNull().default(0),
    totalMinor: integer("total_minor").notNull().default(0),
  },
  (t) => [
    index("purchase_order_item_purchase_order_id_idx").on(t.purchaseOrderId),
    index("purchase_order_item_product_id_idx").on(t.productId),
  ],
);
