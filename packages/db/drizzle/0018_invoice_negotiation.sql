CREATE TABLE "invoice_negotiation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"proposed_total_kobo" integer NOT NULL,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_negotiation_check_proposed_positive" CHECK ("proposed_total_kobo" > 0)
);
--> statement-breakpoint
ALTER TABLE "invoice_negotiation" ADD CONSTRAINT "invoice_negotiation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invoice_negotiation" ADD CONSTRAINT "invoice_negotiation_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "invoice"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "invoice_negotiation_organization_id_idx" ON "invoice_negotiation" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "invoice_negotiation_invoice_id_idx" ON "invoice_negotiation" USING btree ("invoice_id");
--> statement-breakpoint
-- Only one live offer per invoice, so a shared link cannot be used to flood the
-- seller with competing proposals. Decided rows are kept for history.
CREATE UNIQUE INDEX "invoice_negotiation_one_pending_per_invoice_uidx" ON "invoice_negotiation" USING btree ("invoice_id") WHERE "invoice_negotiation"."status" = 'pending';
