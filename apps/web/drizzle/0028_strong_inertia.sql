ALTER TABLE `node_types` ADD `layer_id` text REFERENCES layers(id);--> statement-breakpoint
ALTER TABLE `relation_types` ADD `layer_id` text REFERENCES layers(id);