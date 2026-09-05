CREATE TABLE `catalog_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`vendor` text DEFAULT '' NOT NULL,
	`category` text DEFAULT 'systems' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`signals` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `catalog_entries_name_idx` ON `catalog_entries` (`workspace_id`,`name`);