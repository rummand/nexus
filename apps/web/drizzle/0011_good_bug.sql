CREATE TABLE `plateau_change_sets` (
	`plateau_id` text NOT NULL,
	`change_set_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`plateau_id`, `change_set_id`),
	FOREIGN KEY (`plateau_id`) REFERENCES `plateaus`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`change_set_id`) REFERENCES `change_sets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `plateau_change_sets_set_idx` ON `plateau_change_sets` (`change_set_id`);--> statement-breakpoint
CREATE TABLE `plateaus` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`target_date` text DEFAULT '' NOT NULL,
	`created_by_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `plateaus_workspace_idx` ON `plateaus` (`workspace_id`,`target_date`);