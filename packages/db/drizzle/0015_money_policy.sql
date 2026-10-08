ALTER TABLE "organization" ADD COLUMN "currency" text DEFAULT 'NGN' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "tax_rate_bps" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "organization" SET "tax_rate_bps" = 750 WHERE "currency" = 'NGN';
