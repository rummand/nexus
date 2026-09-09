CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`board_id` text NOT NULL,
	`element_id` text DEFAULT '' NOT NULL,
	`anchor_label` text DEFAULT '' NOT NULL,
	`parent_id` text,
	`author_id` text,
	`author_name` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`resolved_at` text,
	`resolved_by_id` text,
	`resolved_by_name` text DEFAULT '' NOT NULL,
	`edited_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`resolved_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `comments_board_idx` ON `comments` (`board_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `comments_thread_idx` ON `comments` (`parent_id`);--> statement-breakpoint
CREATE INDEX `comments_open_idx` ON `comments` (`workspace_id`,`resolved_at`);