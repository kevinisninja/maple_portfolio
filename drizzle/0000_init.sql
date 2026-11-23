CREATE TYPE "public"."server" AS ENUM('windia', 'zenith');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holding" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"item_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"icon_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_price" (
	"item_id" integer NOT NULL,
	"server" "server" NOT NULL,
	"day" date NOT NULL,
	"price" bigint NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"updated_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "item_price_item_id_server_day_pk" PRIMARY KEY("item_id","server","day")
);
--> statement-breakpoint
CREATE TABLE "portfolio_snapshot" (
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"server" "server" NOT NULL,
	"total_value" bigint NOT NULL,
	"item_count" integer NOT NULL,
	CONSTRAINT "portfolio_snapshot_user_id_day_pk" PRIMARY KEY("user_id","day")
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"server" "server" DEFAULT 'windia' NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profile_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding" ADD CONSTRAINT "holding_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding" ADD CONSTRAINT "holding_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_price" ADD CONSTRAINT "item_price_item_id_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_price" ADD CONSTRAINT "item_price_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_snapshot" ADD CONSTRAINT "portfolio_snapshot_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "holding_user_item_idx" ON "holding" USING btree ("user_id","item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "item_name_lower_idx" ON "item" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "snapshot_day_server_idx" ON "portfolio_snapshot" USING btree ("day","server");