CREATE TABLE "source_trust" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"source_key" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"origin" text DEFAULT 'files' NOT NULL,
	"owns" text DEFAULT '[]' NOT NULL,
	"owns_kind" boolean DEFAULT false NOT NULL,
	"owns_place" boolean DEFAULT false NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "source_trust" ADD CONSTRAINT "source_trust_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "source_trust_key_idx" ON "source_trust" USING btree ("workspace_id","source_key");