CREATE TABLE "change_set_approvals" (
	"change_set_id" text NOT NULL,
	"rule_id" text NOT NULL,
	"by_id" text,
	"by_name" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	CONSTRAINT "change_set_approvals_change_set_id_rule_id_pk" PRIMARY KEY("change_set_id","rule_id")
);
--> statement-breakpoint
CREATE TABLE "model_owners" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"scope" text DEFAULT 'subtree' NOT NULL,
	"scope_value" text DEFAULT '' NOT NULL,
	"user_id" text,
	"team_id" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "change_set_approvals" ADD CONSTRAINT "change_set_approvals_change_set_id_change_sets_id_fk" FOREIGN KEY ("change_set_id") REFERENCES "public"."change_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_set_approvals" ADD CONSTRAINT "change_set_approvals_by_id_users_id_fk" FOREIGN KEY ("by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_owners" ADD CONSTRAINT "model_owners_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_owners" ADD CONSTRAINT "model_owners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_owners" ADD CONSTRAINT "model_owners_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "model_owners_workspace_idx" ON "model_owners" USING btree ("workspace_id");