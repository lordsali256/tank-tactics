ALTER TABLE `arena_results` ADD `winner_points` integer DEFAULT 100 NOT NULL;
--> statement-breakpoint
ALTER TABLE `arena_results` ADD `loser_points` integer DEFAULT 20 NOT NULL;
