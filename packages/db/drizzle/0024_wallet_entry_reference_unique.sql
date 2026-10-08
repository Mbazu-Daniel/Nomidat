-- Makes a wallet credit idempotent against a redelivered webhook: one payment
-- reference may only ever produce one entry per organization.
CREATE UNIQUE INDEX "wallet_entry_organization_id_reference_uidx" ON "wallet_entry" USING btree ("organization_id","reference") WHERE "wallet_entry"."reference" is not null;
