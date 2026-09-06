CREATE TABLE `agent_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`key` text NOT NULL,
	`type` text NOT NULL,
	`confidence` text NOT NULL,
	`title` text NOT NULL,
	`detail` text NOT NULL,
	`entity_ids` text DEFAULT '[]' NOT NULL,
	`action` text NOT NULL,
	`evidence` text DEFAULT '[]' NOT NULL,
	`grounded` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_proposals_key_idx` ON `agent_proposals` (`workspace_id`,`key`);