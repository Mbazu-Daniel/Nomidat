-- A sale records how the money arrives, not only that it is owed.
--
-- `payment` holds the method, but a sale taken on credit writes no `payment` row
-- at creation — the row appears when the money is eventually received. So for the
-- whole period a customer owes money, the business cannot say how they intend to
-- pay, and a till reporting "how do people pay" would see cash only, because
-- every transfer and card payment had been dropped on the floor.
--
-- The column lives on the sale rather than being derived from `payment` because it
-- is an attribute of the sale: a transfer paid partly in cash has no single
-- method to read off the payment rows.

ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "payment_method" text;

-- Backfill from the payment the sale already has, so historical rows answer the
-- question rather than reading as unknown. A sale with several payments keeps the
-- earliest, matching the order they were recorded in.
UPDATE "orders" o
SET "payment_method" = earliest.method
FROM (
  SELECT DISTINCT ON ("order_id") "order_id", "method"
  FROM "payment"
  ORDER BY "order_id", "paid_at", "created_at"
) AS earliest
WHERE o."id" = earliest."order_id"
  AND o."payment_method" IS NULL;

-- The methods the product accepts today: a cash sale, a bank transfer, or a card.
-- A CHECK rather than a Postgres enum so a new method is a drop-and-add here and
-- in code, not an ALTER TYPE on the write path.
--
-- Both bank-transfer spellings are listed because the surfaces disagree: the POS
-- and storefront send 'bank_transfer', the conversational and picture-import paths
-- send 'transfer'. Both reach this column. 0035 widens this list after the first
-- version of the constraint refused the till's own value.
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_payment_method_chk" CHECK (
    "payment_method" IS NULL
    OR "payment_method" IN ('cash', 'bank_transfer', 'transfer', 'card')
  );