ALTER TABLE `arena_profiles` ADD `owned` text;--> statement-breakpoint
ALTER TABLE `arena_results` ADD `paid` integer DEFAULT 1 NOT NULL;