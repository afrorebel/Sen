CREATE TABLE "report_sends" (
	"brand_id" uuid NOT NULL,
	"period" text NOT NULL,
	"recipients" jsonb NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_sends_brand_id_period_pk" PRIMARY KEY("brand_id","period")
);
--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "rec_state" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "report_recipients" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "checks" ADD COLUMN "fan_out" jsonb;--> statement-breakpoint
ALTER TABLE "report_sends" ADD CONSTRAINT "report_sends_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;