CREATE TABLE "agent_proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"key" text NOT NULL,
	"type" text NOT NULL,
	"confidence" text NOT NULL,
	"title" text NOT NULL,
	"detail" text NOT NULL,
	"entity_ids" text DEFAULT '[]' NOT NULL,
	"action" text NOT NULL,
	"evidence" text DEFAULT '[]' NOT NULL,
	"grounded" text DEFAULT '[]' NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_proposals" ADD CONSTRAINT "agent_proposals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_proposals_key_idx" ON "agent_proposals" USING btree ("workspace_id","key");