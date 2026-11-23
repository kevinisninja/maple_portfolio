ALTER TABLE "item" ADD COLUMN "hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- One-time cleanup: untradeable game items have no market price, so drop them
-- (holdings/prices referencing them cascade). The bundled catalog no longer includes them.
DELETE FROM "item" WHERE "tradeable" = false AND "game_id" IS NOT NULL;
