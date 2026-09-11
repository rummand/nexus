CREATE TABLE `source_trust` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`source_key` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`origin` text DEFAULT 'files' NOT NULL,
	`owns` text DEFAULT '[]' NOT NULL,
	`owns_kind` integer DEFAULT false NOT NULL,
	`owns_place` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_trust_key_idx` ON `source_trust` (`workspace_id`,`source_key`);