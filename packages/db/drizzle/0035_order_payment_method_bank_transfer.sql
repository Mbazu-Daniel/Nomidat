-- Fix: the 0033 check rejected the method the till actually sends.
--
-- 0033 constrained orders.payment_method to 'cash', 'transfer' and 'card'. The POS,
-- the storefront and the conversational action schema do not agree on the
-- spelling: the till and the shop send "bank_transfer", while the conversational
-- and picture-import paths send "transfer". So the constraint refused every
-- bank-transfer sale taken at the counter — a check added to catch bad data
-- instead broke the common path.
--
-- Both spellings are accepted rather than one being renamed here. Which word a
-- surface uses is a product decision about the POS, the storefront, the chat
-- assistant and the expense editor at once, and renaming them all in a migration
-- would silently rewrite the meaning of rows already recorded by each. This
-- migration only stops the database from rejecting the app's own vocabulary.
--
-- To pick one spelling later, change the callers first, backfill, then narrow this
-- constraint to the survivor.

ALTER TABLE "orders"
  DROP CONSTRAINT IF EXISTS "orders_payment_method_chk";

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_payment_method_chk" CHECK (
    "payment_method" IS NULL
    OR "payment_method" IN ('cash', 'bank_transfer', 'transfer', 'card')
  );