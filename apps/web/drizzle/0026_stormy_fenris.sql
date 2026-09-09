CREATE TABLE `framework_adoptions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`framework_id` text NOT NULL,
	`adopted_by` text,
	`adopted_by_name` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `framework_adoptions_workspace_idx` ON `framework_adoptions` (`workspace_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `framework_adoptions_one_idx` ON `framework_adoptions` (`workspace_id`,`framework_id`);--> statement-breakpoint
ALTER TABLE `node_types` ADD `framework` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `node_types` ADD `level` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `relation_types` ADD `framework` text DEFAULT '' NOT NULL;