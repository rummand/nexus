CREATE TABLE "entity_events" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"entity_id" text NOT NULL,
	"entity_name" text DEFAULT '' NOT NULL,
	"kind" text NOT NULL,
	"field" text DEFAULT '' NOT NULL,
	"from_value" text DEFAULT '' NOT NULL,
	"to_value" text DEFAULT '' NOT NULL,
	"actor_kind" text DEFAULT 'system' NOT NULL,
	"actor_id" text,
	"actor_name" text DEFAULT '' NOT NULL,
	"context" text DEFAULT '' NOT NULL,
	"at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entity_events" ADD CONSTRAINT "entity_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entity_events_workspace_idx" ON "entity_events" USING btree ("workspace_id","at");--> statement-breakpoint
CREATE INDEX "entity_events_entity_idx" ON "entity_events" USING btree ("entity_id","at");