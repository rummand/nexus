CREATE TABLE "model_providers" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"dialect" text DEFAULT 'anthropic' NOT NULL,
	"base_url" text DEFAULT '' NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"api_key" text DEFAULT '' NOT NULL,
	"key_encrypted" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'unknown' NOT NULL,
	"status_detail" text DEFAULT '' NOT NULL,
	"checked_at" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_tasks" (
	"workspace_id" text NOT NULL,
	"task" text NOT NULL,
	"provider_id" text,
	"model" text DEFAULT '' NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	CONSTRAINT "model_tasks_workspace_id_task_pk" PRIMARY KEY("workspace_id","task")
);
--> statement-breakpoint
ALTER TABLE "model_providers" ADD CONSTRAINT "model_providers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_tasks" ADD CONSTRAINT "model_tasks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_tasks" ADD CONSTRAINT "model_tasks_provider_id_model_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."model_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "model_providers_workspace_idx" ON "model_providers" USING btree ("workspace_id");