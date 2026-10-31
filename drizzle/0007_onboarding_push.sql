CREATE TABLE "push_subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscription_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "vapid_keys" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"public_key" text NOT NULL,
	"private_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vapid_keys_single_row" CHECK ("vapid_keys"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "morning_time" text DEFAULT '07:30' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "evening_time" text DEFAULT '21:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "day_before_reminder" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "follow_up_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "follow_up_delay_minutes" smallint DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "onboarded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_subscription_user_id_idx" ON "push_subscription" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_follow_up_delay_minutes_check" CHECK ("user_settings"."follow_up_delay_minutes" between 15 and 240);