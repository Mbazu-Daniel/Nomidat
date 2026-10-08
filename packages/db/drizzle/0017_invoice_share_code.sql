ALTER TABLE "invoice" ADD COLUMN "share_code" text;
--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "share_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_share_code_uidx" ON "invoice" ("share_code");