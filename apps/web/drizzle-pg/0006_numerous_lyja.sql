CREATE TABLE "agent_remark_outcomes" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"board_id" text,
	"agent_element_id" text NOT NULL,
	"agent_name" text DEFAULT '' NOT NULL,
	"outcome" text NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_remark_outcomes" ADD CONSTRAINT "agent_remark_outcomes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_remark_outcomes" ADD CONSTRAINT "agent_remark_outcomes_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_outcomes_workspace_idx" ON "agent_remark_outcomes" USING btree ("workspace_id","agent_element_id");