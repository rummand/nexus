CREATE TABLE `board_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`reason` text DEFAULT 'auto' NOT NULL,
	`document` text NOT NULL,
	`object_count` integer DEFAULT 0 NOT NULL,
	`created_by_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `board_versions_board_idx` ON `board_versions` (`board_id`,`created_at`);