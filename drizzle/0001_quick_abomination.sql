CREATE TABLE `arena_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`name` text NOT NULL,
	`units` text NOT NULL,
	`map` text NOT NULL,
	`power` integer NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `arena_results` (
	`code` text PRIMARY KEY NOT NULL,
	`winner` text NOT NULL,
	`loser` text NOT NULL,
	`completed` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `arena_matches` ADD `attacker` text;--> statement-breakpoint
ALTER TABLE `arena_matches` ADD `defender` text;