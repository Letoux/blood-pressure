CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"channel" text NOT NULL,
	"kind" text NOT NULL,
	"date" date NOT NULL,
	"moment" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_reminder_unique" UNIQUE NULLS NOT DISTINCT("user_id","channel","kind","date","moment")
);
--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;