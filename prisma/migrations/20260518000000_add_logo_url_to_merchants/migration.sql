-- Add logo_url column to merchants for dedicated logo storage URL

ALTER TABLE "core"."merchants"
ADD COLUMN IF NOT EXISTS "logo_url" TEXT;
