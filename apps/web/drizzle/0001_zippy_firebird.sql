CREATE TABLE `board_entities` (
	`board_id` text NOT NULL,
	`entity_id` text NOT NULL,
	`element_id` text NOT NULL,
	PRIMARY KEY(`board_id`, `entity_id`, `element_id`),
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `board_entities_entity_idx` ON `board_entities` (`entity_id`);--> statement-breakpoint
CREATE TABLE `entities` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`kind` text DEFAULT '' NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`attributes` text DEFAULT '{}' NOT NULL,
	`source` text DEFAULT 'canvas' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `entities_workspace_idx` ON `entities` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `entities_kind_idx` ON `entities` (`workspace_id`,`kind`);--> statement-breakpoint
CREATE TABLE `relations` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`from_entity_id` text NOT NULL,
	`to_entity_id` text NOT NULL,
	`kind` text DEFAULT '' NOT NULL,
	`attributes` text DEFAULT '{}' NOT NULL,
	`source` text DEFAULT 'canvas' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `relations_workspace_idx` ON `relations` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `relations_from_idx` ON `relations` (`from_entity_id`);--> statement-breakpoint
CREATE INDEX `relations_to_idx` ON `relations` (`to_entity_id`);