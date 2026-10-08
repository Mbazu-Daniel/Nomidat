CREATE TABLE "storefront_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"template" text DEFAULT 'minimal' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"theme" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"seo" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"checkout" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"pages" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"custom_css" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "storefront_domain" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"hostname" text NOT NULL,
	"kind" text DEFAULT 'custom' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "cart" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"token" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"contact_id" uuid,
	"subtotal_kobo" integer DEFAULT 0 NOT NULL,
	"discount_kobo" integer DEFAULT 0 NOT NULL,
	"tax_kobo" integer DEFAULT 0 NOT NULL,
	"total_kobo" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'NGN' NOT NULL,
	"converted_order_id" uuid,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "cart_item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"cart_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"product_name" text NOT NULL,
	"unit_price_kobo" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "storefront_settings" ADD CONSTRAINT "storefront_settings_org_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storefront_domain" ADD CONSTRAINT "storefront_domain_org_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart" ADD CONSTRAINT "cart_org_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart" ADD CONSTRAINT "cart_contact_fk" FOREIGN KEY ("contact_id") REFERENCES "contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_cart_fk" FOREIGN KEY ("cart_id") REFERENCES "cart"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_product_fk" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "storefront_settings_organization_id_uidx" ON "storefront_settings" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "storefront_settings_published_idx" ON "storefront_settings" USING btree ("published");--> statement-breakpoint
CREATE UNIQUE INDEX "storefront_domain_hostname_uidx" ON "storefront_domain" USING btree ("hostname");--> statement-breakpoint
CREATE INDEX "storefront_domain_organization_id_idx" ON "storefront_domain" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cart_token_uidx" ON "cart" USING btree ("token");--> statement-breakpoint
CREATE INDEX "cart_organization_id_status_idx" ON "cart" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "cart_item_cart_id_idx" ON "cart_item" USING btree ("cart_id");--> statement-breakpoint
CREATE INDEX "cart_item_product_id_idx" ON "cart_item" USING btree ("product_id");
