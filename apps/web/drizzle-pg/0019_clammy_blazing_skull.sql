CREATE TABLE "framework_adoptions" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"framework_id" text NOT NULL,
	"adopted_by" text,
	"adopted_by_name" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "node_types" ADD COLUMN "framework" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "node_types" ADD COLUMN "level" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "relation_types" ADD COLUMN "framework" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "framework_adoptions" ADD CONSTRAINT "framework_adoptions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "framework_adoptions_workspace_idx" ON "framework_adoptions" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "framework_adoptions_one_idx" ON "framework_adoptions" USING btree ("workspace_id","framework_id");