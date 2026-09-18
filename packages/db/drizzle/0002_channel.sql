CREATE TABLE "channel_identity" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"display_name" text,
	"last_inbound_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_link_code" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "channel_link_code_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "channel_identity" ADD CONSTRAINT "channel_identity_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_link_code" ADD CONSTRAINT "channel_link_code_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_link_code" ADD CONSTRAINT "channel_link_code_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "channel_identity_provider_external_id_uidx" ON "channel_identity" USING btree ("provider","external_id");--> statement-breakpoint
CREATE INDEX "channel_identity_organization_id_idx" ON "channel_identity" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "channel_link_code_organization_id_idx" ON "channel_link_code" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "channel_link_code_code_idx" ON "channel_link_code" USING btree ("code");