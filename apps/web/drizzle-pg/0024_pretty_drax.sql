ALTER TABLE "entities" ADD COLUMN "parent_id" text;--> statement-breakpoint
CREATE INDEX "entities_parent_idx" ON "entities" USING btree ("parent_id");