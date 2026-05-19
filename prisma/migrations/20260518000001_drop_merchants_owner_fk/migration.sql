-- Drop the FK constraint to auth.users to avoid cross-schema issues with Prisma
-- The application still enforces owner_user_id validity via business logic

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'merchants_owner_user_id_fkey'
  ) THEN
    ALTER TABLE "core"."merchants" DROP CONSTRAINT "merchants_owner_user_id_fkey";
  END IF;
END $$;
