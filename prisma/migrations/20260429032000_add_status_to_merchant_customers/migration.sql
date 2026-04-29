ALTER TABLE "core"."merchant_customers"
ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS "merchant_customers_merchant_id_status_idx"
ON "core"."merchant_customers"("merchant_id", "status");
