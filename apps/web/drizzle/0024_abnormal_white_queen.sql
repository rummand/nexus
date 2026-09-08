-- Ownership on the three workspace-scoped rows that had none (§5.46).
--
-- Hand-written, because `ALTER TABLE … ADD COLUMN … REFERENCES users(id)` in SQLite silently drops
-- the delete action: the column would carry a plain reference here and `ON DELETE set null` in
-- Postgres, so deleting a person would fail on one dialect and null the column on the other. A
-- divergence between the two stores is exactly what the generated-schema test exists to prevent,
-- so each table is rebuilt the long way instead.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_mcp_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`prefix` text DEFAULT '' NOT NULL,
	`hash` text NOT NULL,
	`scope` text DEFAULT 'read' NOT NULL,
	`agent_id` text,
	`created_by_id` text,
	`last_used_at` text,
	`revoked_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agent_definitions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
INSERT INTO `__new_mcp_tokens`("id","workspace_id","name","prefix","hash","scope","agent_id","created_by_id","last_used_at","revoked_at","created_at")
SELECT "id","workspace_id","name","prefix","hash","scope","agent_id",NULL,"last_used_at","revoked_at","created_at" FROM `mcp_tokens`;--> statement-breakpoint
DROP TABLE `mcp_tokens`;--> statement-breakpoint
ALTER TABLE `__new_mcp_tokens` RENAME TO `mcp_tokens`;--> statement-breakpoint
CREATE INDEX `mcp_tokens_workspace_idx` ON `mcp_tokens` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `__new_mcp_servers` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`api_key` text DEFAULT '' NOT NULL,
	`key_encrypted` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_by_id` text,
	`status` text DEFAULT 'unknown' NOT NULL,
	`status_detail` text DEFAULT '' NOT NULL,
	`tools` text DEFAULT '[]' NOT NULL,
	`checked_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
INSERT INTO `__new_mcp_servers`("id","workspace_id","name","url","api_key","key_encrypted","enabled","created_by_id","status","status_detail","tools","checked_at","created_at","updated_at")
SELECT "id","workspace_id","name","url","api_key","key_encrypted","enabled",NULL,"status","status_detail","tools","checked_at","created_at","updated_at" FROM `mcp_servers`;--> statement-breakpoint
DROP TABLE `mcp_servers`;--> statement-breakpoint
ALTER TABLE `__new_mcp_servers` RENAME TO `mcp_servers`;--> statement-breakpoint
CREATE INDEX `mcp_servers_workspace_idx` ON `mcp_servers` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `__new_model_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`dialect` text DEFAULT 'anthropic' NOT NULL,
	`base_url` text DEFAULT '' NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`api_key` text DEFAULT '' NOT NULL,
	`key_encrypted` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_by_id` text,
	`status` text DEFAULT 'unknown' NOT NULL,
	`status_detail` text DEFAULT '' NOT NULL,
	`checked_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);--> statement-breakpoint
INSERT INTO `__new_model_providers`("id","workspace_id","name","dialect","base_url","model","api_key","key_encrypted","enabled","created_by_id","status","status_detail","checked_at","created_at","updated_at")
SELECT "id","workspace_id","name","dialect","base_url","model","api_key","key_encrypted","enabled",NULL,"status","status_detail","checked_at","created_at","updated_at" FROM `model_providers`;--> statement-breakpoint
DROP TABLE `model_providers`;--> statement-breakpoint
ALTER TABLE `__new_model_providers` RENAME TO `model_providers`;--> statement-breakpoint
CREATE INDEX `model_providers_workspace_idx` ON `model_providers` (`workspace_id`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
