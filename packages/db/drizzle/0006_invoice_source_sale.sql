ALTER TABLE "invoice" ADD COLUMN "source_sale_id" uuid;
CREATE UNIQUE INDEX "invoice_organization_id_source_sale_uidx" ON "invoice" ("organization_id","source_sale_id");