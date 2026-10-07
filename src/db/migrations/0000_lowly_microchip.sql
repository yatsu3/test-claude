CREATE TABLE `daily_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`sleep_minutes` integer,
	`sleep_source` text,
	`condition` integer NOT NULL,
	`condition_note` text,
	`caffeine` text NOT NULL,
	`exercise` text NOT NULL,
	`alcohol` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_records_date_unique` ON `daily_records` (`date`);