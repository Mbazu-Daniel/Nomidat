CREATE TABLE "payment" (
  "id" uuid PRIMARY KEY NOT NULL,
  "organization_id" uuid NOT NULL,
  "order_id" uuid NOT NULL,
  "contact_id" uuid,
  "amount_kobo" integer NOT NULL,
  "currency" text DEFAULT 'NGN' NOT NULL,
  "method" text DEFAULT 'cash' NOT NULL,
  "reference" text,
  "notes" text,
  "paid_at" timestamp DEFAULT now() NOT NULL,
  "created_by_user_id" uuid,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_contact_id_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_organization_id_idx" ON "payment" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "payment_organization_id_order_id_idx" ON "payment" USING btree ("organization_id","order_id");--> statement-breakpoint
CREATE INDEX "payment_organization_id_contact_id_idx" ON "payment" USING btree ("organization_id","contact_id");--> statement-breakpoint
CREATE INDEX "payment_created_by_user_id_idx" ON "payment" USING btree ("created_by_user_id");