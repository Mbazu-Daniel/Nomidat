CREATE TABLE "announcement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"published_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "announcement" ADD CONSTRAINT "announcement_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "announcement_organization_id_published_at_idx" ON "announcement" USING btree ("organization_id","published_at");
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"kind" text DEFAULT 'info' NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"dedupe_key" text,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "notification_user_id_created_at_idx" ON "notification" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "notification_organization_id_idx" ON "notification" USING btree ("organization_id");
--> statement-breakpoint
-- Partial so a notification without a dedupe key is never blocked by another
-- one that also has none: only an explicit key means "this exact event, once".
CREATE UNIQUE INDEX "notification_user_id_dedupe_key_uidx" ON "notification" USING btree ("user_id","dedupe_key") WHERE "notification"."dedupe_key" is not null;
--> statement-breakpoint
CREATE TABLE "outbound_webhook" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"url" text NOT NULL,
	"events" text NOT NULL,
	"secret" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_delivery_at" timestamp,
	"last_status_code" integer,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outbound_webhook" ADD CONSTRAINT "outbound_webhook_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "outbound_webhook_organization_id_idx" ON "outbound_webhook" USING btree ("organization_id");
