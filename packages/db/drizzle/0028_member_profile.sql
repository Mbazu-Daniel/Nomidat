-- Member profile: the person's name and face inside one business.
--
-- These hang off the member rather than the user because the same login can be
-- the owner of one shop and a clerk at another, and each business wants to see a
-- different name. All nullable, so existing members stay valid until they fill
-- them in.
ALTER TABLE "member" ADD COLUMN IF NOT EXISTS "first_name" text;

ALTER TABLE "member" ADD COLUMN IF NOT EXISTS "last_name" text;

ALTER TABLE "member" ADD COLUMN IF NOT EXISTS "avatar" text;