CREATE TABLE "warehouse" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"kind" text DEFAULT 'store' NOT NULL,
	"address" text,
	"phone" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "stock" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"batch_id" uuid,
	"warehouse_id" uuid NOT NULL,
	"on_hand" numeric(15,3) DEFAULT 0 NOT NULL,
	"reserved" numeric(15,3) DEFAULT 0 NOT NULL,
	"in_transit" numeric(15,3) DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "stock_movement" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"batch_id" uuid,
	"warehouse_id" uuid NOT NULL,
	"type" text NOT NULL,
	"quantity" numeric(15,3) NOT NULL,
	"previous_balance" numeric(15,3) NOT NULL,
	"new_balance" numeric(15,3) NOT NULL,
	"reference_id" uuid,
	"reference_type" text,
	"notes" text,
	"created_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "unit_of_measure" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"category" text NOT NULL,
	"precision" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "unit_conversion" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"from_unit_of_measure_id" uuid NOT NULL,
	"to_unit_of_measure_id" uuid NOT NULL,
	"factor" numeric(20,10) NOT NULL
);--> statement-breakpoint
CREATE TABLE "product_category" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"parent_category_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "product_category_assignment" (
	"organization_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "product_category_assignment_pkey" PRIMARY KEY("product_id","category_id")
);--> statement-breakpoint
CREATE TABLE "supplier" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"address" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "warehouse" ADD CONSTRAINT "warehouse_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock" ADD CONSTRAINT "stock_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock" ADD CONSTRAINT "stock_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock" ADD CONSTRAINT "stock_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_of_measure" ADD CONSTRAINT "unit_of_measure_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_conversion" ADD CONSTRAINT "unit_conversion_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_conversion" ADD CONSTRAINT "unit_conversion_from_fk" FOREIGN KEY ("from_unit_of_measure_id") REFERENCES "unit_of_measure"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_conversion" ADD CONSTRAINT "unit_conversion_to_fk" FOREIGN KEY ("to_unit_of_measure_id") REFERENCES "unit_of_measure"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category" ADD CONSTRAINT "product_category_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category" ADD CONSTRAINT "product_category_parent_fk" FOREIGN KEY ("parent_category_id") REFERENCES "product_category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category_assignment" ADD CONSTRAINT "product_category_assignment_org_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category_assignment" ADD CONSTRAINT "product_category_assignment_product_fk" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category_assignment" ADD CONSTRAINT "product_category_assignment_category_fk" FOREIGN KEY ("category_id") REFERENCES "product_category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier" ADD CONSTRAINT "supplier_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "barcode" text;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "base_unit_of_measure_id" uuid;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_base_unit_fk" FOREIGN KEY ("base_unit_of_measure_id") REFERENCES "unit_of_measure"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "warehouse_organization_id_idx" ON "warehouse" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "warehouse_organization_id_code_uidx" ON "warehouse" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "stock_organization_id_idx" ON "stock" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "stock_organization_id_product_id_idx" ON "stock" USING btree ("organization_id","product_id");--> statement-breakpoint
CREATE INDEX "stock_organization_id_warehouse_id_idx" ON "stock" USING btree ("organization_id","warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_org_product_wh_uidx" ON "stock" USING btree ("organization_id","product_id","warehouse_id") WHERE "stock"."variant_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "stock_org_product_variant_wh_uidx" ON "stock" USING btree ("organization_id","product_id","variant_id","warehouse_id") WHERE "stock"."variant_id" is not null;--> statement-breakpoint
CREATE INDEX "stock_movement_organization_id_idx" ON "stock_movement" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "stock_movement_organization_id_product_id_idx" ON "stock_movement" USING btree ("organization_id","product_id");--> statement-breakpoint
CREATE INDEX "stock_movement_organization_id_warehouse_id_idx" ON "stock_movement" USING btree ("organization_id","warehouse_id");--> statement-breakpoint
CREATE INDEX "stock_movement_organization_id_created_at_idx" ON "stock_movement" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_movement_reference_id_idx" ON "stock_movement" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "unit_of_measure_organization_id_idx" ON "unit_of_measure" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_of_measure_organization_id_code_uidx" ON "unit_of_measure" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "unit_conversion_organization_id_idx" ON "unit_conversion" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unit_conversion_pair_uidx" ON "unit_conversion" USING btree ("organization_id","from_unit_of_measure_id","to_unit_of_measure_id");--> statement-breakpoint
CREATE INDEX "product_category_organization_id_idx" ON "product_category" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_category_organization_id_slug_uidx" ON "product_category" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "product_category_parent_id_idx" ON "product_category" USING btree ("parent_category_id");--> statement-breakpoint
CREATE INDEX "product_category_assignment_category_id_idx" ON "product_category_assignment" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "product_category_assignment_organization_id_idx" ON "product_category_assignment" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "supplier_organization_id_idx" ON "supplier" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "product_organization_id_barcode_idx" ON "product" USING btree ("organization_id","barcode");--> statement-breakpoint
INSERT INTO "warehouse" ("id","organization_id","name","code","kind","is_default","is_active","created_at","updated_at") -- The organization table's key column is "id", not "organization_id"; selecting
-- the latter here made this statement fail on a real database.
SELECT gen_random_uuid(), o."id", 'Main store', 'MAIN', 'store', true, true, now(), now() FROM "organization" o WHERE NOT EXISTS (SELECT 1 FROM "warehouse" w WHERE w."organization_id" = o."id");--> statement-breakpoint
INSERT INTO "stock" ("id","organization_id","product_id","warehouse_id","on_hand","reserved","in_transit","updated_at") SELECT gen_random_uuid(), p."organization_id", p."id", w."id", p."stock_quantity", 0, 0, now() FROM "product" p JOIN "warehouse" w ON w."organization_id" = p."organization_id" AND w."is_default" = true;--> statement-breakpoint
INSERT INTO "stock_movement" ("id","organization_id","product_id","warehouse_id","type","quantity","previous_balance","new_balance","notes","created_at") SELECT gen_random_uuid(), s."organization_id", s."product_id", s."warehouse_id", 'inbound_receive', s."on_hand", 0, s."on_hand", 'Opening balance migrated from product stock quantity', now() FROM "stock" s WHERE s."on_hand" <> 0;--> statement-breakpoint
ALTER TABLE "product" DROP COLUMN "stock_quantity";
