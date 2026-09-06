CREATE TABLE `change_set_dependencies` (
	`change_set_id` text NOT NULL,
	`depends_on_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	PRIMARY KEY(`change_set_id`, `depends_on_id`),
	FOREIGN KEY (`change_set_id`) REFERENCES `change_sets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`depends_on_id`) REFERENCES `change_sets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `change_set_deps_blocker_idx` ON `change_set_dependencies` (`depends_on_id`);