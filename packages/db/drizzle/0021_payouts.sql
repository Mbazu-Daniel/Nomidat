CREATE TABLE "payout_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"business_name" text NOT NULL,
	"bank_code" text NOT NULL,
	"bank_name" text NOT NULL,
	"account_number" text NOT NULL,
	"account_name" text NOT NULL,
	"subaccount_code" text,
	"platform_fee_bps" integer DEFAULT 0 NOT NULL,
	"activated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payout_account" ADD CONSTRAINT "payout_account_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "payout_account_organization_id_uidx" ON "payout_account" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "payout_account_subaccount_code_idx" ON "payout_account" USING btree ("subaccount_code");
--> statement-breakpoint
CREATE TABLE "virtual_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"account_number" text NOT NULL,
	"account_name" text NOT NULL,
	"bank_name" text NOT NULL,
	"customer_code" text,
	"split_code" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "virtual_account" ADD CONSTRAINT "virtual_account_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "virtual_account_organization_id_idx" ON "virtual_account" USING btree ("organization_id");
--> statement-breakpoint
-- An inbound transfer is attributed by the account number alone, so it must
-- identify exactly one tenant.
CREATE UNIQUE INDEX "virtual_account_account_number_uidx" ON "virtual_account" USING btree ("account_number");
--> statement-breakpoint
CREATE TABLE "wallet_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount_kobo" integer NOT NULL,
	"currency" text DEFAULT 'NGN' NOT NULL,
	"balance_after_kobo" integer NOT NULL,
	"reference" text,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "wallet_entry" ADD CONSTRAINT "wallet_entry_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "wallet_entry_organization_id_created_at_idx" ON "wallet_entry" USING btree ("organization_id","created_at");
--> statement-breakpoint
CREATE INDEX "wallet_entry_organization_id_reference_idx" ON "wallet_entry" USING btree ("organization_id","reference");
--> statement-breakpoint
CREATE TABLE "payout_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"amount_kobo" integer NOT NULL,
	"currency" text DEFAULT 'NGN' NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"bank_code" text NOT NULL,
	"bank_name" text NOT NULL,
	"account_number" text NOT NULL,
	"account_name" text NOT NULL,
	"requested_by_user_id" uuid,
	"reason" text,
	"decided_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payout_request" ADD CONSTRAINT "payout_request_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "payout_request" ADD CONSTRAINT "payout_request_requested_by_user_id_user_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "payout_request_organization_id_created_at_idx" ON "payout_request" USING btree ("organization_id","created_at");
--> statement-breakpoint
CREATE INDEX "payout_request_organization_id_status_idx" ON "payout_request" USING btree ("organization_id","status");
--> statement-breakpoint
CREATE INDEX "payout_request_requested_by_user_id_idx" ON "payout_request" USING btree ("requested_by_user_id");
