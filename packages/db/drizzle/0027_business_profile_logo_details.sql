-- Business profile: the logo and invoice details a seller sets once.
--
-- Both are nullable and additive: existing rows keep whatever they had, and the
-- older phone/email/address columns stay until every reader has moved over.
ALTER TABLE "business_profile" ADD COLUMN IF NOT EXISTS "logo" text;

ALTER TABLE "business_profile" ADD COLUMN IF NOT EXISTS "business_details" jsonb;
