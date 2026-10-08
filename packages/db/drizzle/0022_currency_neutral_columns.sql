-- Rename the money columns to be currency-neutral.
--
-- The stored values do not change: these are always integers in the currency's
-- minor unit, and the system is not Naira-only, so "kobo" in the schema was
-- misleading. The TypeScript columns were renamed to match (amountMinor,
-- totalMinor, ...) and this brings the physical columns into line.
--
-- Written as RENAME rather than by editing 0003 and friends, so this is
-- correct whether or not those migrations have already been applied.
--
-- Generated from the CREATE TABLE statements, so no column is missed.
ALTER TABLE "cart" RENAME COLUMN "discount_kobo" TO "discount_minor";
--> statement-breakpoint
ALTER TABLE "cart" RENAME COLUMN "subtotal_kobo" TO "subtotal_minor";
--> statement-breakpoint
ALTER TABLE "cart" RENAME COLUMN "tax_kobo" TO "tax_minor";
--> statement-breakpoint
ALTER TABLE "cart" RENAME COLUMN "total_kobo" TO "total_minor";
--> statement-breakpoint
ALTER TABLE "cart_item" RENAME COLUMN "unit_price_kobo" TO "unit_price_minor";
--> statement-breakpoint
ALTER TABLE "expense" RENAME COLUMN "amount_kobo" TO "amount_minor";
--> statement-breakpoint
ALTER TABLE "invoice" RENAME COLUMN "discount_kobo" TO "discount_minor";
--> statement-breakpoint
ALTER TABLE "invoice" RENAME COLUMN "subtotal_kobo" TO "subtotal_minor";
--> statement-breakpoint
ALTER TABLE "invoice" RENAME COLUMN "tax_kobo" TO "tax_minor";
--> statement-breakpoint
ALTER TABLE "invoice" RENAME COLUMN "total_kobo" TO "total_minor";
--> statement-breakpoint
ALTER TABLE "invoice_item" RENAME COLUMN "total_kobo" TO "total_minor";
--> statement-breakpoint
ALTER TABLE "invoice_item" RENAME COLUMN "unit_price_kobo" TO "unit_price_minor";
--> statement-breakpoint
ALTER TABLE "invoice_negotiation" RENAME COLUMN "proposed_total_kobo" TO "proposed_total_minor";
--> statement-breakpoint
ALTER TABLE "order_item" RENAME COLUMN "total_kobo" TO "total_minor";
--> statement-breakpoint
ALTER TABLE "order_item" RENAME COLUMN "unit_price_kobo" TO "unit_price_minor";
--> statement-breakpoint
ALTER TABLE "orders" RENAME COLUMN "discount_kobo" TO "discount_minor";
--> statement-breakpoint
ALTER TABLE "orders" RENAME COLUMN "subtotal_kobo" TO "subtotal_minor";
--> statement-breakpoint
ALTER TABLE "orders" RENAME COLUMN "tax_kobo" TO "tax_minor";
--> statement-breakpoint
ALTER TABLE "orders" RENAME COLUMN "total_kobo" TO "total_minor";
--> statement-breakpoint
ALTER TABLE "payment" RENAME COLUMN "amount_kobo" TO "amount_minor";
--> statement-breakpoint
ALTER TABLE "payment_link" RENAME COLUMN "amount_kobo" TO "amount_minor";
--> statement-breakpoint
ALTER TABLE "payout_request" RENAME COLUMN "amount_kobo" TO "amount_minor";
--> statement-breakpoint
ALTER TABLE "product" RENAME COLUMN "cost_kobo" TO "cost_minor";
--> statement-breakpoint
ALTER TABLE "product" RENAME COLUMN "price_kobo" TO "price_minor";
--> statement-breakpoint
ALTER TABLE "product_variant" RENAME COLUMN "cost_kobo" TO "cost_minor";
--> statement-breakpoint
ALTER TABLE "product_variant" RENAME COLUMN "price_kobo" TO "price_minor";
--> statement-breakpoint
ALTER TABLE "purchase_order" RENAME COLUMN "discount_kobo" TO "discount_minor";
--> statement-breakpoint
ALTER TABLE "purchase_order" RENAME COLUMN "subtotal_kobo" TO "subtotal_minor";
--> statement-breakpoint
ALTER TABLE "purchase_order" RENAME COLUMN "tax_kobo" TO "tax_minor";
--> statement-breakpoint
ALTER TABLE "purchase_order" RENAME COLUMN "total_kobo" TO "total_minor";
--> statement-breakpoint
ALTER TABLE "purchase_order_item" RENAME COLUMN "total_kobo" TO "total_minor";
--> statement-breakpoint
ALTER TABLE "purchase_order_item" RENAME COLUMN "unit_cost_kobo" TO "unit_cost_minor";
--> statement-breakpoint
ALTER TABLE "stock_return" RENAME COLUMN "discount_kobo" TO "discount_minor";
--> statement-breakpoint
ALTER TABLE "stock_return" RENAME COLUMN "subtotal_kobo" TO "subtotal_minor";
--> statement-breakpoint
ALTER TABLE "stock_return" RENAME COLUMN "tax_kobo" TO "tax_minor";
--> statement-breakpoint
ALTER TABLE "stock_return" RENAME COLUMN "total_kobo" TO "total_minor";
--> statement-breakpoint
ALTER TABLE "stock_return_item" RENAME COLUMN "total_kobo" TO "total_minor";
--> statement-breakpoint
ALTER TABLE "stock_return_item" RENAME COLUMN "unit_price_kobo" TO "unit_price_minor";
--> statement-breakpoint
ALTER TABLE "wallet_entry" RENAME COLUMN "amount_kobo" TO "amount_minor";
--> statement-breakpoint
ALTER TABLE "wallet_entry" RENAME COLUMN "balance_after_kobo" TO "balance_after_minor";
--> statement-breakpoint