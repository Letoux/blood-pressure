ALTER TABLE "campaign" ADD COLUMN "original_start" date;--> statement-breakpoint
ALTER TABLE "campaign" ADD COLUMN "status" text;--> statement-breakpoint
ALTER TABLE "campaign" ADD COLUMN "skipped_on" date;--> statement-breakpoint
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_skipped_on_check" CHECK (coalesce("campaign"."status" = 'skipped', false) = ("campaign"."skipped_on" is not null));