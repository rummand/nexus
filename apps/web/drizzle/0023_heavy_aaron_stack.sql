CREATE TABLE `entity_events` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`entity_name` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`field` text DEFAULT '' NOT NULL,
	`from_value` text DEFAULT '' NOT NULL,
	`to_value` text DEFAULT '' NOT NULL,
	`actor_kind` text DEFAULT 'system' NOT NULL,
	`actor_id` text,
	`actor_name` text DEFAULT '' NOT NULL,
	`context` text DEFAULT '' NOT NULL,
	`at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `entity_events_workspace_idx` ON `entity_events` (`workspace_id`,`at`);--> statement-breakpoint
CREATE INDEX `entity_events_entity_idx` ON `entity_events` (`entity_id`,`at`);