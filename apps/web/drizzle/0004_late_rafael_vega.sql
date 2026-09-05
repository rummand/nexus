CREATE TABLE `node_type_fields` (
	`id` text PRIMARY KEY NOT NULL,
	`node_type_id` text NOT NULL,
	`key` text NOT NULL,
	`data_type` text DEFAULT 'text' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`required` integer DEFAULT false NOT NULL,
	`options` text DEFAULT '[]' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`node_type_id`) REFERENCES `node_types`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `node_type_fields_type_idx` ON `node_type_fields` (`node_type_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `node_type_fields_key_idx` ON `node_type_fields` (`node_type_id`,`key`);--> statement-breakpoint
CREATE TABLE `node_types` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`color` text DEFAULT '' NOT NULL,
	`parent_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `node_types_workspace_idx` ON `node_types` (`workspace_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `node_types_name_idx` ON `node_types` (`workspace_id`,`name`);--> statement-breakpoint
CREATE TABLE `relation_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`relation_type_id` text NOT NULL,
	`from_type` text NOT NULL,
	`to_type` text NOT NULL,
	`cardinality` text DEFAULT 'many-to-many' NOT NULL,
	FOREIGN KEY (`relation_type_id`) REFERENCES `relation_types`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `relation_rules_type_idx` ON `relation_rules` (`relation_type_id`);--> statement-breakpoint
CREATE TABLE `relation_types` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `relation_types_workspace_idx` ON `relation_types` (`workspace_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `relation_types_name_idx` ON `relation_types` (`workspace_id`,`name`);