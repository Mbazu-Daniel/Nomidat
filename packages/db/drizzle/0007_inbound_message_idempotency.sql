ALTER TABLE "message" ADD COLUMN "provider" text;
ALTER TABLE "message" ADD COLUMN "raw_update_id" text;
ALTER TABLE "message" ADD COLUMN "inbound_response" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "message_provider_raw_update_id_uidx" ON "message" USING btree ("provider","raw_update_id");
