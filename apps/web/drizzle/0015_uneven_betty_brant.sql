CREATE TABLE `model_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`dialect` text DEFAULT 'anthropic' NOT NULL,
	`base_url` text DEFAULT '' NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`api_key` text DEFAULT '' NOT NULL,
	`key_encrypted` integer DEFAULT false NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'unknown' NOT NULL,
	`status_detail` text DEFAULT '' NOT NULL,
	`checked_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `model_providers_workspace_idx` ON `model_providers` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `model_tasks` (
	`workspace_id` text NOT NULL,
	`task` text NOT NULL,
	`provider_id` text,
	`model` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`workspace_id`, `task`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`provider_id`) REFERENCES `model_providers`(`id`) ON UPDATE no action ON DELETE cascade
);
