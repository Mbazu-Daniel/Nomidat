CREATE TABLE "product_variant" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sku" text,
	"barcode" text,
	"price_kobo" integer DEFAULT 0 NOT NULL,
	"cost_kobo" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "batch" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"code" text NOT NULL,
	"expires_at" timestamp,
	"quantity_received" numeric(15,3) DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "serial_number" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"code" text NOT NULL,
	"status" text DEFAULT 'in_stock' NOT NULL,
	"sold_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "stock_transfer" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"from_warehouse_id" uuid NOT NULL,
	"to_warehouse_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"dispatched_at" timestamp,
	"received_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "stock_transfer_item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"transfer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"quantity" numeric(15,3) NOT NULL
);--> statement-breakpoint
CREATE TABLE "cycle_count" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"counted_at" timestamp,
	"applied_at" timestamp,
	"created_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "cycle_count_line" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"cycle_count_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"expected_quantity" numeric(15,3) NOT NULL,
	"counted_quantity" numeric(15,3)
);--> statement-breakpoint
CREATE TABLE "stock_return" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"order_id" uuid,
	"contact_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"restock" boolean DEFAULT true NOT NULL,
	"reason" text,
	"notes" text,
	"subtotal_kobo" integer DEFAULT 0 NOT NULL,
	"discount_kobo" integer DEFAULT 0 NOT NULL,
	"tax_kobo" integer DEFAULT 0 NOT NULL,
	"total_kobo" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'NGN' NOT NULL,
	"received_at" timestamp,
	"created_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "stock_return_item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"return_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"quantity" numeric(15,3) NOT NULL,
	"unit_price_kobo" integer DEFAULT 0 NOT NULL,
	"total_kobo" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint
CREATE TABLE "purchase_order" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"supplier_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"expected_at" timestamp,
	"ordered_at" timestamp,
	"received_at" timestamp,
	"notes" text,
	"subtotal_kobo" integer DEFAULT 0 NOT NULL,
	"discount_kobo" integer DEFAULT 0 NOT NULL,
	"tax_kobo" integer DEFAULT 0 NOT NULL,
	"total_kobo" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'NGN' NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "purchase_order_item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"quantity_ordered" numeric(15,3) NOT NULL,
	"quantity_received" numeric(15,3) DEFAULT 0 NOT NULL,
	"unit_cost_kobo" integer DEFAULT 0 NOT NULL,
	"total_kobo" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_org_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_product_fk" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch" ADD CONSTRAINT "batch_org_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch" ADD CONSTRAINT "batch_product_fk" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch" ADD CONSTRAINT "batch_variant_fk" FOREIGN KEY ("variant_id") REFERENCES "product_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serial_number" ADD CONSTRAINT "serial_number_org_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "serial_number" ADD CONSTRAINT "serial_number_product_fk" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_org_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_from_fk" FOREIGN KEY ("from_warehouse_id") REFERENCES "warehouse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_to_fk" FOREIGN KEY ("to_warehouse_id") REFERENCES "warehouse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_item" ADD CONSTRAINT "stock_transfer_item_transfer_fk" FOREIGN KEY ("transfer_id") REFERENCES "stock_transfer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transfer_item" ADD CONSTRAINT "stock_transfer_item_product_fk" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_count" ADD CONSTRAINT "cycle_count_org_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_count" ADD CONSTRAINT "cycle_count_warehouse_fk" FOREIGN KEY ("warehouse_id") REFERENCES "warehouse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_count_line" ADD CONSTRAINT "cycle_count_line_count_fk" FOREIGN KEY ("cycle_count_id") REFERENCES "cycle_count"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle_count_line" ADD CONSTRAINT "cycle_count_line_product_fk" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_return" ADD CONSTRAINT "stock_return_org_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_return" ADD CONSTRAINT "stock_return_contact_fk" FOREIGN KEY ("contact_id") REFERENCES "contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_return_item" ADD CONSTRAINT "stock_return_item_return_fk" FOREIGN KEY ("return_id") REFERENCES "stock_return"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_return_item" ADD CONSTRAINT "stock_return_item_product_fk" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_org_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order" ADD CONSTRAINT "purchase_order_supplier_fk" FOREIGN KEY ("supplier_id") REFERENCES "supplier"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_item" ADD CONSTRAINT "purchase_order_item_order_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_item" ADD CONSTRAINT "purchase_order_item_product_fk" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock" ADD CONSTRAINT "stock_variant_fk" FOREIGN KEY ("variant_id") REFERENCES "product_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock" ADD CONSTRAINT "stock_batch_fk" FOREIGN KEY ("batch_id") REFERENCES "batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_variant_fk" FOREIGN KEY ("variant_id") REFERENCES "product_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_variant_organization_id_idx" ON "product_variant" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "product_variant_product_id_idx" ON "product_variant" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variant_organization_id_sku_uidx" ON "product_variant" USING btree ("organization_id","sku");--> statement-breakpoint
CREATE INDEX "batch_organization_id_idx" ON "batch" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "batch_organization_id_product_id_idx" ON "batch" USING btree ("organization_id","product_id");--> statement-breakpoint
CREATE INDEX "batch_expires_at_idx" ON "batch" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "batch_organization_id_code_uidx" ON "batch" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "serial_number_organization_id_idx" ON "serial_number" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "serial_number_organization_id_status_idx" ON "serial_number" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "serial_number_organization_id_code_uidx" ON "serial_number" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "stock_transfer_organization_id_idx" ON "stock_transfer" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "stock_transfer_organization_id_status_idx" ON "stock_transfer" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_transfer_organization_id_reference_uidx" ON "stock_transfer" USING btree ("organization_id","reference");--> statement-breakpoint
CREATE INDEX "stock_transfer_item_transfer_id_idx" ON "stock_transfer_item" USING btree ("transfer_id");--> statement-breakpoint
CREATE INDEX "stock_transfer_item_product_id_idx" ON "stock_transfer_item" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "cycle_count_organization_id_idx" ON "cycle_count" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "cycle_count_organization_id_status_idx" ON "cycle_count" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "cycle_count_organization_id_reference_uidx" ON "cycle_count" USING btree ("organization_id","reference");--> statement-breakpoint
CREATE INDEX "cycle_count_line_cycle_count_id_idx" ON "cycle_count_line" USING btree ("cycle_count_id");--> statement-breakpoint
CREATE INDEX "cycle_count_line_product_id_idx" ON "cycle_count_line" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "stock_return_organization_id_idx" ON "stock_return" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "stock_return_organization_id_status_idx" ON "stock_return" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_return_organization_id_reference_uidx" ON "stock_return" USING btree ("organization_id","reference");--> statement-breakpoint
CREATE INDEX "stock_return_item_return_id_idx" ON "stock_return_item" USING btree ("return_id");--> statement-breakpoint
CREATE INDEX "stock_return_item_product_id_idx" ON "stock_return_item" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "purchase_order_organization_id_idx" ON "purchase_order" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "purchase_order_organization_id_status_idx" ON "purchase_order" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "purchase_order_supplier_id_idx" ON "purchase_order" USING btree ("supplier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_order_organization_id_reference_uidx" ON "purchase_order" USING btree ("organization_id","reference");--> statement-breakpoint
CREATE INDEX "purchase_order_item_purchase_order_id_idx" ON "purchase_order_item" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "purchase_order_item_product_id_idx" ON "purchase_order_item" USING btree ("product_id");
