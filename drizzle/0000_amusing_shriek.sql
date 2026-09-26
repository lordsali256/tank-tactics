CREATE TABLE `arena_matches` (
	`code` text PRIMARY KEY NOT NULL,
	`token_a` text NOT NULL,
	`token_b` text,
	`units_a` text NOT NULL,
	`units_b` text,
	`map` text NOT NULL,
	`seed` integer NOT NULL,
	`state` text,
	`updated` integer NOT NULL,
	`expires` integer NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_arena_matches_expires` ON `arena_matches` (`expires`);