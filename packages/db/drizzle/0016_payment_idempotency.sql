-- Idempotency for redelivered payment webhooks.
--
-- The unique constraint belongs on "payment", not "payment_link": "payment_link.reference"
-- is already globally unique from 0003, so a composite index there would guarantee
-- nothing new. "payment" is the ledger that a replayed webhook would double-insert into,
-- and its insert used onConflictDoNothing() with no matching constraint to catch.
--
-- reference is nullable so that cash sales (which have no provider reference) are not
-- forced into a shared value; Postgres treats NULLs as distinct, so they are exempt.
CREATE UNIQUE INDEX "payment_organization_id_reference_uidx" ON "payment" USING btree ("organization_id","reference");
