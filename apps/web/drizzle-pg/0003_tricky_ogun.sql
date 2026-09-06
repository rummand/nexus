CREATE TABLE "change_set_dependencies" (
	"change_set_id" text NOT NULL,
	"depends_on_id" text NOT NULL,
	"created_at" text DEFAULT to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	CONSTRAINT "change_set_dependencies_change_set_id_depends_on_id_pk" PRIMARY KEY("change_set_id","depends_on_id")
);
--> statement-breakpoint
ALTER TABLE "change_set_dependencies" ADD CONSTRAINT "change_set_dependencies_change_set_id_change_sets_id_fk" FOREIGN KEY ("change_set_id") REFERENCES "public"."change_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_set_dependencies" ADD CONSTRAINT "change_set_dependencies_depends_on_id_change_sets_id_fk" FOREIGN KEY ("depends_on_id") REFERENCES "public"."change_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "change_set_deps_blocker_idx" ON "change_set_dependencies" USING btree ("depends_on_id");