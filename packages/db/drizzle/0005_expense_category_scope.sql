ALTER TABLE "expense_category" ADD COLUMN "organization_id" uuid REFERENCES "organization"("id") ON DELETE CASCADE;
DROP INDEX IF EXISTS "expense_category_name_unique";
CREATE INDEX "expense_category_organization_id_idx" ON "expense_category" ("organization_id");
CREATE UNIQUE INDEX "expense_category_organization_id_name_uidx" ON "expense_category" ("organization_id","name");