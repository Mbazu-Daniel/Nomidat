import { index, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";
import { createActiveTimestampColumns } from "../active-timestamp-columns";
import { createOrgScopedColumns } from "../org-scoped-columns";

/** The kind of thing measured. Two units only convert if they share a category. */
export const UNIT_CATEGORIES = ["count", "weight", "volume", "length"] as const;
export type UnitCategory = (typeof UNIT_CATEGORIES)[number];

export const unitOfMeasure = pgTable(
  "unit_of_measure",
  {
    ...createOrgScopedColumns(),
    name: text("name").notNull(),
    /** Short form the seller types, e.g. kg, pcs, carton. */
    code: text("code").notNull(),
    category: text("category").$type<UnitCategory>().notNull(),
    /** Decimal places this unit is quoted in, e.g. 3 for kg, 0 for pcs. */
    precision: integer("precision").notNull().default(0),
    ...createActiveTimestampColumns(),
  },
  (t) => [
    index("unit_of_measure_organization_id_idx").on(t.organizationId),
    uniqueIndex("unit_of_measure_organization_id_code_uidx").on(t.organizationId, t.code),
  ],
);
