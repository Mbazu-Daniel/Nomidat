import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createActiveTimestampColumns } from "../active-timestamp-columns";
import { createOrgScopedColumns } from "../org-scoped-columns";
import { product } from "../products/product";
import { productVariant } from "./product-variant";
import { order } from "../orders/order";

export const SERIAL_STATUSES = ["in_stock", "sold", "returned", "void"] as const;
export type SerialStatus = (typeof SERIAL_STATUSES)[number];

/** A single individually-tracked unit, e.g. a phone with its own IMEI. */
export const serialNumber = pgTable(
  "serial_number",
  {
    ...createOrgScopedColumns(),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariant.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    status: text("status").$type<SerialStatus>().notNull().default("in_stock"),
    /**
     * The sale that moved this unit. Without it a sold serial records only that
     * it was sold, never what for, so a warranty claim or a recall cannot be
     * answered. Set null if the order is ever deleted; the unit stays.
     */
    orderId: uuid("order_id").references(() => order.id, { onDelete: "set null" }),
    soldAt: timestamp("sold_at"),
    ...createActiveTimestampColumns(),
  },
  (t) => [
    index("serial_number_organization_id_idx").on(t.organizationId),
    index("serial_number_organization_id_status_idx").on(t.organizationId, t.status),
    index("serial_number_order_id_idx").on(t.orderId),
    uniqueIndex("serial_number_organization_id_code_uidx").on(t.organizationId, t.code),
  ],
);
