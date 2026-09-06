CREATE TABLE "agent_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"purpose" text DEFAULT '' NOT NULL,
	"owner_team_id" text,
	"scope" text DEFAULT '' NOT NULL,
	"verbs" text DEFAULT '[]' NOT NULL,
	"grounding" text DEFAULT '' NOT NULL,
	"provider_id" text,
	"model" text DEFAULT '' NOT NULL,
	"trigger" text DEFAULT 'manual' NOT NULL,
	"budget" text DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"parent_id" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"agent_id" text,
	"agent_name" text DEFAULT '' NOT NULL,
	"trigger" text DEFAULT 'manual' NOT NULL,
	"outcome" text DEFAULT 'ok' NOT NULL,
	"dry_run" boolean DEFAULT false NOT NULL,
	"scope" text DEFAULT '' NOT NULL,
	"objects_read" integer DEFAULT 0 NOT NULL,
	"proposed" integer DEFAULT 0 NOT NULL,
	"rejected" integer DEFAULT 0 NOT NULL,
	"detail" text DEFAULT '[]' NOT NULL,
	"proposals" text DEFAULT '[]' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"error" text DEFAULT '' NOT NULL,
	"ms" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_decisions" ADD COLUMN "agent_id" text;--> statement-breakpoint
ALTER TABLE "agent_proposals" ADD COLUMN "agent_id" text;--> statement-breakpoint
ALTER TABLE "agent_proposals" ADD COLUMN "run_id" text;--> statement-breakpoint
ALTER TABLE "agent_definitions" ADD CONSTRAINT "agent_definitions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_definitions" ADD CONSTRAINT "agent_definitions_owner_team_id_teams_id_fk" FOREIGN KEY ("owner_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_definitions" ADD CONSTRAINT "agent_definitions_provider_id_model_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."model_providers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_agent_id_agent_definitions_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_definitions_workspace_idx" ON "agent_definitions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "agent_runs_workspace_idx" ON "agent_runs" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "agent_runs_agent_idx" ON "agent_runs" USING btree ("agent_id");