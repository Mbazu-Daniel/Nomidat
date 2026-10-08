import { index, numeric, pgTable, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createOrgScopedColumns } from "../org-scoped-columns";
import { unitOfMeasure } from "./unit-of-measure";

/**
 * A conversion factor belongs to the *pair* of units, not to either unit alone:
 * a kg is 1000 g, but there is no "kg-ness" that is 1000 on its own. Storing
 * factors on the unit would make the inverse direction a second hand-written row.
 */
export const unitConversion = pgTable(
  "unit_conversion",
  {
    ...createOrgScopedColumns(),
    fromUnitOfMeasureId: uuid("from_unit_of_measure_id")
      .notNull()
      .references(() => unitOfMeasure.id, { onDelete: "cascade" }),
    toUnitOfMeasureId: uuid("to_unit_of_measure_id")
      .notNull()
      .references(() => unitOfMeasure.id, { onDelete: "cascade" }),
    /** result = value * factor. High precision so chained conversions stay exact. */
    factor: numeric("factor", { precision: 20, scale: 10, mode: "number" }).notNull(),
  },
  (t) => [
    index("unit_conversion_organization_id_idx").on(t.organizationId),
    uniqueIndex("unit_conversion_pair_uidx").on(
      t.organizationId,
      t.fromUnitOfMeasureId,
      t.toUnitOfMeasureId,
    ),
  ],
);
