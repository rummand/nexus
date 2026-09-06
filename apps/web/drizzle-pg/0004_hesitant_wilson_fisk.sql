CREATE TABLE "plateau_change_sets" (
	"plateau_id" text NOT NULL,
	"change_set_id" text NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	CONSTRAINT "plateau_change_sets_plateau_id_change_set_id_pk" PRIMARY KEY("plateau_id","change_set_id")
);
--> statement-breakpoint
CREATE TABLE "plateaus" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"target_date" text DEFAULT '' NOT NULL,
	"created_by_id" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plateau_change_sets" ADD CONSTRAINT "plateau_change_sets_plateau_id_plateaus_id_fk" FOREIGN KEY ("plateau_id") REFERENCES "public"."plateaus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plateau_change_sets" ADD CONSTRAINT "plateau_change_sets_change_set_id_change_sets_id_fk" FOREIGN KEY ("change_set_id") REFERENCES "public"."change_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plateaus" ADD CONSTRAINT "plateaus_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plateaus" ADD CONSTRAINT "plateaus_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plateau_change_sets_set_idx" ON "plateau_change_sets" USING btree ("change_set_id");--> statement-breakpoint
CREATE INDEX "plateaus_workspace_idx" ON "plateaus" USING btree ("workspace_id","target_date");