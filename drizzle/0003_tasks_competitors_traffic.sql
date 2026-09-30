CREATE TABLE "ai_traffic" (
	"brand_id" uuid NOT NULL,
	"day" text NOT NULL,
	"kind" text NOT NULL,
	"agent" text NOT NULL,
	"path" text DEFAULT '/' NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_traffic_brand_id_day_kind_agent_path_pk" PRIMARY KEY("brand_id","day","kind","agent","path")
);
--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "rec_steps" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "key_competitors" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "ignored_brands" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "traffic_token" text;--> statement-breakpoint
ALTER TABLE "ai_traffic" ADD CONSTRAINT "ai_traffic_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;