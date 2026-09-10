CREATE TABLE `wiki_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`parent_id` text,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`icon` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`source` text DEFAULT '' NOT NULL,
	`created_by_id` text,
	`updated_by_name` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `wiki_pages_workspace_idx` ON `wiki_pages` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `wiki_pages_parent_idx` ON `wiki_pages` (`parent_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `wiki_pages_slug_idx` ON `wiki_pages` (`workspace_id`,`slug`);