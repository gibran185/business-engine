-- Multi-staff scheduling: staff assignment, capabilities, and working hours.

-- 1) Merchants: timezone for local business day interpretation.
ALTER TABLE "core"."merchants"
ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'UTC';

-- 2) Appointments: assign to staff + snapshot duration/end.
ALTER TABLE "core"."appointments"
ADD COLUMN IF NOT EXISTS "merchant_staff_id" UUID,
ADD COLUMN IF NOT EXISTS "end_time" TIMESTAMPTZ(6),
ADD COLUMN IF NOT EXISTS "duration_minutes" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'appointments_merchant_staff_id_fkey'
  ) THEN
    ALTER TABLE "core"."appointments"
    ADD CONSTRAINT "appointments_merchant_staff_id_fkey"
    FOREIGN KEY ("merchant_staff_id") REFERENCES "core"."merchant_staff"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "appointments_merchant_id_merchant_staff_id_start_time_idx"
ON "core"."appointments" ("merchant_id", "merchant_staff_id", "start_time");

-- 3) Staff service capability map (many-to-many).
CREATE TABLE IF NOT EXISTS "core"."staff_services" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "merchant_id" UUID,
  "merchant_staff_id" UUID,
  "service_id" UUID,
  "created_at" TIMESTAMPTZ(6) DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_services_merchant_id_fkey'
  ) THEN
    ALTER TABLE "core"."staff_services"
    ADD CONSTRAINT "staff_services_merchant_id_fkey"
    FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_services_merchant_staff_id_fkey'
  ) THEN
    ALTER TABLE "core"."staff_services"
    ADD CONSTRAINT "staff_services_merchant_staff_id_fkey"
    FOREIGN KEY ("merchant_staff_id") REFERENCES "core"."merchant_staff"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_services_service_id_fkey'
  ) THEN
    ALTER TABLE "core"."staff_services"
    ADD CONSTRAINT "staff_services_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "core"."services"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "staff_services_merchant_staff_id_service_id_key"
ON "core"."staff_services" ("merchant_staff_id", "service_id");

CREATE INDEX IF NOT EXISTS "staff_services_merchant_id_service_id_idx"
ON "core"."staff_services" ("merchant_id", "service_id");

CREATE INDEX IF NOT EXISTS "staff_services_service_id_merchant_staff_id_idx"
ON "core"."staff_services" ("service_id", "merchant_staff_id");

-- 4) Staff working hours (weekly).
CREATE TABLE IF NOT EXISTS "core"."staff_working_hours" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "merchant_id" UUID,
  "merchant_staff_id" UUID,
  "day_of_week" INTEGER NOT NULL,
  "start_minute" INTEGER NOT NULL,
  "end_minute" INTEGER NOT NULL,
  "is_active" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMPTZ(6) DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_working_hours_merchant_id_fkey'
  ) THEN
    ALTER TABLE "core"."staff_working_hours"
    ADD CONSTRAINT "staff_working_hours_merchant_id_fkey"
    FOREIGN KEY ("merchant_id") REFERENCES "core"."merchants"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_working_hours_merchant_staff_id_fkey'
  ) THEN
    ALTER TABLE "core"."staff_working_hours"
    ADD CONSTRAINT "staff_working_hours_merchant_staff_id_fkey"
    FOREIGN KEY ("merchant_staff_id") REFERENCES "core"."merchant_staff"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "staff_working_hours_merchant_staff_id_day_of_week_idx"
ON "core"."staff_working_hours" ("merchant_staff_id", "day_of_week");

CREATE INDEX IF NOT EXISTS "staff_working_hours_merchant_id_day_of_week_idx"
ON "core"."staff_working_hours" ("merchant_id", "day_of_week");

