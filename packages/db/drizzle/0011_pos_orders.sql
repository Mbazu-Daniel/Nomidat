ALTER TABLE "orders" ADD COLUMN "order_number" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_provider" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "client_reference" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN "product_sku" text;--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN "discount_kobo" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Postgres does not allow a window function directly in UPDATE ... SET, so the
-- numbering is computed in a CTE and joined back in.
WITH numbered AS (
  SELECT "id", row_number() OVER (PARTITION BY "organization_id" ORDER BY "created_at" ASC, "id" ASC) AS n
  FROM "orders"
  WHERE "order_number" IS NULL
)
UPDATE "orders" o
SET "order_number" = 'ORD-' || lpad(numbered.n::text, 4, '0')
FROM numbered
WHERE o."id" = numbered."id";--> statement-breakpoint
CREATE UNIQUE INDEX "orders_organization_id_order_number_uidx" ON "orders" USING btree ("organization_id","order_number");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_organization_id_client_reference_uidx" ON "orders" USING btree ("organization_id","client_reference");--> statement-breakpoint
CREATE INDEX "orders_organization_id_source_idx" ON "orders" USING btree ("organization_id","source");
