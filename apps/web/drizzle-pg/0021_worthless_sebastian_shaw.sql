ALTER TABLE "node_types" ADD COLUMN "layer_id" text;--> statement-breakpoint
ALTER TABLE "relation_types" ADD COLUMN "layer_id" text;--> statement-breakpoint
ALTER TABLE "node_types" ADD CONSTRAINT "node_types_layer_id_layers_id_fk" FOREIGN KEY ("layer_id") REFERENCES "public"."layers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relation_types" ADD CONSTRAINT "relation_types_layer_id_layers_id_fk" FOREIGN KEY ("layer_id") REFERENCES "public"."layers"("id") ON DELETE set null ON UPDATE no action;