CREATE TABLE "measurement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"taken_at" timestamp with time zone NOT NULL,
	"systolic" smallint NOT NULL,
	"diastolic" smallint NOT NULL,
	"pulse" smallint NOT NULL,
	"comment" text,
	"moment" text NOT NULL,
	"campaign_id" uuid,
	"campaign_day" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "measurement_campaign_slot_check" CHECK (("measurement"."campaign_id" is null and "measurement"."campaign_day" is null) or ("measurement"."campaign_id" is not null and "measurement"."campaign_day" between 1 and 3))
);
--> statement-breakpoint
ALTER TABLE "measurement" ADD CONSTRAINT "measurement_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "measurement_user_id_taken_at_idx" ON "measurement" USING btree ("user_id","taken_at");--> statement-breakpoint
CREATE INDEX "measurement_campaign_id_idx" ON "measurement" USING btree ("campaign_id");