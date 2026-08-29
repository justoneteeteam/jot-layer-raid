CREATE TABLE IF NOT EXISTS `email_suppressions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`reason` text NOT NULL,
	`source` text DEFAULT 'system',
	`created_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `email_suppressions_email_unique` ON `email_suppressions` (`email`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_suppressions_email` ON `email_suppressions` (`email`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_suppressions_reason` ON `email_suppressions` (`reason`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `email_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`to_email` text NOT NULL,
	`from_email` text NOT NULL,
	`subject` text NOT NULL,
	`status` text NOT NULL,
	`message_id` text,
	`error_message` text,
	`created_at` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_email_logs_to_email` ON `email_logs` (`to_email`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_email_logs_status` ON `email_logs` (`status`);
