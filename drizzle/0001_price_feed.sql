CREATE TABLE "price_refresh" (
	"item_id" integer NOT NULL,
	"server" "server" NOT NULL,
	"last_attempt_at" timestamp with time zone NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_error" text,
	CONSTRAINT "price_refresh_item_id_server_pk" PRIMARY KEY("item_id","server")
);
--> statement-breakpoint
ALTER TABLE "item" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "price_refresh" ADD CONSTRAINT "price_refresh_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_external_id_unique" UNIQUE("external_id");