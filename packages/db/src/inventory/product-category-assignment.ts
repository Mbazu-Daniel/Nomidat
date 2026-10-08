import { index, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { product } from "../products/product";
import { productCategory } from "./product-category";

/**
 * Products can sit in several categories at once, so this is a join rather than
 * a categoryId column on the product.
 */
export const productCategoryAssignment = pgTable(
  "product_category_assignment",
  {
    organizationId: uuid("organization_id").notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => productCategory.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.categoryId] }),
    index("product_category_assignment_category_id_idx").on(t.categoryId),
    index("product_category_assignment_organization_id_idx").on(t.organizationId),
  ],
);
