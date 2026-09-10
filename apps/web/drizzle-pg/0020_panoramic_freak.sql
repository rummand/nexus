CREATE TABLE "layers" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"color" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "layers" ADD CONSTRAINT "layers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "layers_workspace_idx" ON "layers" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "layers_name_idx" ON "layers" USING btree ("workspace_id","name");--> statement-breakpoint
ALTER TABLE "node_types" DROP COLUMN "level";