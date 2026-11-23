DROP INDEX "item_name_lower_idx";--> statement-breakpoint
ALTER TABLE "item" ADD COLUMN "game_id" integer;--> statement-breakpoint
ALTER TABLE "item" ADD COLUMN "tab" text;--> statement-breakpoint
ALTER TABLE "item" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "item" ADD COLUMN "tradeable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "item" ADD COLUMN "npc_price" bigint;--> statement-breakpoint
ALTER TABLE "item" ADD COLUMN "stats" jsonb;--> statement-breakpoint
CREATE INDEX "item_tab_category_idx" ON "item" USING btree ("tab","category");--> statement-breakpoint
CREATE INDEX "item_name_lower_idx" ON "item" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_game_id_unique" UNIQUE("game_id");