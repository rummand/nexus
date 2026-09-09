CREATE TABLE "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"board_id" text NOT NULL,
	"element_id" text DEFAULT '' NOT NULL,
	"anchor_label" text DEFAULT '' NOT NULL,
	"parent_id" text,
	"author_id" text,
	"author_name" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"resolved_at" text,
	"resolved_by_id" text,
	"resolved_by_name" text DEFAULT '' NOT NULL,
	"edited_at" text,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_resolved_by_id_users_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_board_idx" ON "comments" USING btree ("board_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_thread_idx" ON "comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "comments_open_idx" ON "comments" USING btree ("workspace_id","resolved_at");