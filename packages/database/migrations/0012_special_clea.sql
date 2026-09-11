ALTER TABLE "organization_billing" ALTER COLUMN "plan" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "organization_billing" ALTER COLUMN "plan" SET DEFAULT 'starter'::text;--> statement-breakpoint
UPDATE "organization_billing" SET "plan" = 'starter' WHERE "plan" = 'free';--> statement-breakpoint
UPDATE "organization_billing" SET "plan" = 'growth' WHERE "plan" = 'pro';--> statement-breakpoint
DROP TYPE "public"."organization_plan";--> statement-breakpoint
CREATE TYPE "public"."organization_plan" AS ENUM('starter', 'growth');--> statement-breakpoint
ALTER TABLE "organization_billing" ALTER COLUMN "plan" SET DEFAULT 'starter'::"public"."organization_plan";--> statement-breakpoint
ALTER TABLE "organization_billing" ALTER COLUMN "plan" SET DATA TYPE "public"."organization_plan" USING "plan"::"public"."organization_plan";