-- Merchant customers directory: profile mirror + merchant/customer relationship.

CREATE TABLE IF NOT EXISTS "core"."customer_profiles" (
  "id" UUID PRIMARY KEY,
  "email" TEXT,
  "phone_number" TEXT,
  "full_name" TEXT,
  "created_at" TIMESTAMPTZ(6) DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "core"."merchant_customers" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "merchant_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "first_seen_at" TIMESTAMPTZ(6) DEFAULT now(),
  "last_seen_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'merchant_customers_merchant_id_fkey'
  ) THEN
    ALTER TABLE "core"."merchant_customers"
    ADD CONSTRAINT "merchant_customers_merchant_id_fkey"
    FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'merchant_customers_customer_id_fkey'
  ) THEN
    ALTER TABLE "core"."merchant_customers"
    ADD CONSTRAINT "merchant_customers_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "core"."customer_profiles"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "merchant_customers_merchant_id_customer_id_key"
ON "core"."merchant_customers" ("merchant_id", "customer_id");

CREATE INDEX IF NOT EXISTS "merchant_customers_customer_id_idx"
ON "core"."merchant_customers" ("customer_id");
