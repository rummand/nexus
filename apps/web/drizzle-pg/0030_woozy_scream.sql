ALTER TABLE "change_sets" ADD COLUMN "source_key" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX "change_sets_source_idx" ON "change_sets" USING btree ("workspace_id","source_key");