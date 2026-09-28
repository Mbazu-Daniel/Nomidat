CREATE TABLE IF NOT EXISTS "inbound_update" (
  "id" uuid PRIMARY KEY NOT NULL,
  "organization_id" uuid NOT NULL,
  "provider" text NOT NULL,
  "raw_update_id" text NOT NULL,
  "response" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp,
  CONSTRAINT "inbound_update_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade
);
CREATE UNIQUE INDEX IF NOT EXISTS "inbound_update_provider_update_unique" ON "inbound_update" USING btree ("organization_id","provider","raw_update_id");
CREATE INDEX IF NOT EXISTS "inbound_update_organization_id_idx" ON "inbound_update" USING btree ("organization_id");
--> statement-breakpoint
ALTER TABLE "channel_identity" ADD COLUMN "user_id" uuid REFERENCES "user"("id") ON DELETE CASCADE;
CREATE INDEX "channel_identity_user_id_idx" ON "channel_identity"("user_id");
ALTER TABLE "expense_category" DROP CONSTRAINT IF EXISTS "expense_category_name_unique";
