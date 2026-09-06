CREATE TABLE `agent_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`purpose` text DEFAULT '' NOT NULL,
	`owner_team_id` text,
	`scope` text DEFAULT '' NOT NULL,
	`verbs` text DEFAULT '[]' NOT NULL,
	`grounding` text DEFAULT '' NOT NULL,
	`provider_id` text,
	`model` text DEFAULT '' NOT NULL,
	`trigger` text DEFAULT 'manual' NOT NULL,
	`budget` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`parent_id` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`provider_id`) REFERENCES `model_providers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `agent_definitions_workspace_idx` ON `agent_definitions` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `agent_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`agent_id` text,
	`agent_name` text DEFAULT '' NOT NULL,
	`trigger` text DEFAULT 'manual' NOT NULL,
	`outcome` text DEFAULT 'ok' NOT NULL,
	`dry_run` integer DEFAULT false NOT NULL,
	`scope` text DEFAULT '' NOT NULL,
	`objects_read` integer DEFAULT 0 NOT NULL,
	`proposed` integer DEFAULT 0 NOT NULL,
	`rejected` integer DEFAULT 0 NOT NULL,
	`detail` text DEFAULT '[]' NOT NULL,
	`proposals` text DEFAULT '[]' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`error` text DEFAULT '' NOT NULL,
	`ms` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agent_definitions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agent_runs_workspace_idx` ON `agent_runs` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `agent_runs_agent_idx` ON `agent_runs` (`agent_id`);--> statement-breakpoint
ALTER TABLE `agent_decisions` ADD `agent_id` text;--> statement-breakpoint
ALTER TABLE `agent_proposals` ADD `agent_id` text;--> statement-breakpoint
ALTER TABLE `agent_proposals` ADD `run_id` text;