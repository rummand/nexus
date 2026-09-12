ALTER TABLE `change_sets` ADD `board_id` text REFERENCES boards(id);--> statement-breakpoint
CREATE INDEX `change_sets_board_idx` ON `change_sets` (`board_id`,`status`);