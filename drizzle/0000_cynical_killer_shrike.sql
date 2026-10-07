CREATE TABLE `checkins` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`checkpoint` text NOT NULL,
	`scanned_at` text NOT NULL,
	`scanned_by` text NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_checkin_per_checkpoint` ON `checkins` (`ticket_id`,`checkpoint`);--> statement-breakpoint
CREATE TABLE `event_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`date` text NOT NULL,
	`time` text NOT NULL,
	`departure` text NOT NULL,
	`destination` text NOT NULL,
	`price_cents` integer,
	`capacity` integer,
	`program` text NOT NULL,
	`checkpoints` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`token` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`amount_cents` integer,
	`created_at` text NOT NULL,
	`paid_at` text,
	`paid_by` text,
	`cancelled_at` text,
	`refunded_at` text,
	`sent_at` text,
	`email_id` text,
	`email_attempt` text,
	`email_error` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tickets_reference_unique` ON `tickets` (`reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `tickets_token_unique` ON `tickets` (`token`);