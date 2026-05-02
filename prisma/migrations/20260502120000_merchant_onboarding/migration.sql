-- Merchant onboarding: structured legal representative, headquarters, geolocation, owner link to auth.users.

ALTER TABLE "core"."merchants"
ADD COLUMN IF NOT EXISTS "owner_user_id" UUID,
ADD COLUMN IF NOT EXISTS "legal_representative_first_name" TEXT,
ADD COLUMN IF NOT EXISTS "legal_representative_last_name" TEXT,
ADD COLUMN IF NOT EXISTS "tax_id" TEXT,
ADD COLUMN IF NOT EXISTS "headquarters_first_line" TEXT,
ADD COLUMN IF NOT EXISTS "headquarters_second_line" TEXT,
ADD COLUMN IF NOT EXISTS "headquarters_zipcode" TEXT,
ADD COLUMN IF NOT EXISTS "headquarters_municipality" TEXT,
ADD COLUMN IF NOT EXISTS "headquarters_state" TEXT,
ADD COLUMN IF NOT EXISTS "headquarters_country" TEXT,
ADD COLUMN IF NOT EXISTS "headquarters_latitude" DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS "headquarters_longitude" DECIMAL(11, 8);

CREATE INDEX IF NOT EXISTS "merchants_owner_user_id_idx" ON "core"."merchants"("owner_user_id");

CREATE INDEX IF NOT EXISTS "merchants_tax_id_idx" ON "core"."merchants"("tax_id");

-- Optional FK to Supabase auth.users (skip when auth.users is absent, e.g. bare local Postgres).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'merchants_owner_user_id_fkey'
  ) THEN
    ALTER TABLE "core"."merchants"
    ADD CONSTRAINT "merchants_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "auth"."users"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

-- RLS: allow authenticated users to create their merchant and first staff row (onboarding).
-- Existing "Staff manage own merchant" does not allow INSERT before a staff row exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'core' AND tablename = 'merchants' AND policyname = 'Owner creates merchant'
  ) THEN
    CREATE POLICY "Owner creates merchant" ON "core"."merchants"
    FOR INSERT
    WITH CHECK (owner_user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'core' AND tablename = 'merchant_staff' AND policyname = 'Owner inserts self as staff'
  ) THEN
    CREATE POLICY "Owner inserts self as staff" ON "core"."merchant_staff"
    FOR INSERT
    WITH CHECK (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM "core"."merchants" m
        WHERE m.id = merchant_id
          AND m.owner_user_id = auth.uid()
      )
    );
  END IF;
END $$;
