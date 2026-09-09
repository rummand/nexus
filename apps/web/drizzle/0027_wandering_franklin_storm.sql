CREATE TABLE `layers` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`color` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`source` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `layers_workspace_idx` ON `layers` (`workspace_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `layers_name_idx` ON `layers` (`workspace_id`,`name`);--> statement-breakpoint
ALTER TABLE `node_types` DROP COLUMN `level`;