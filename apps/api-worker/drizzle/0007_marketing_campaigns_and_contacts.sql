CREATE TABLE IF NOT EXISTS `marketing_contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`store_id` text DEFAULT 'WaiRaiders Store',
	`email` text NOT NULL,
	`first_name` text,
	`last_name` text,
	`consent_status` text DEFAULT 'subscribed',
	`consent_source` text DEFAULT 'csv_import',
	`is_valid` integer DEFAULT 1,
	`validation_note` text,
	`created_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `marketing_contacts_email_unique` ON `marketing_contacts` (`email`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_marketing_contacts_email` ON `marketing_contacts` (`email`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_marketing_contacts_store` ON `marketing_contacts` (`store_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_marketing_contacts_consent` ON `marketing_contacts` (`consent_status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_marketing_contacts_valid` ON `marketing_contacts` (`is_valid`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `email_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`store_id` text DEFAULT 'WaiRaiders Store',
	`name` text NOT NULL,
	`subject` text NOT NULL,
	`body_html` text NOT NULL,
	`created_at` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_email_templates_store` ON `email_templates` (`store_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `marketing_campaigns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`subject` text NOT NULL,
	`body_html` text NOT NULL,
	`store_id` text DEFAULT 'WaiRaiders Store',
	`sender_identity_id` integer REFERENCES `email_sender_identities`(`id`),
	`status` text DEFAULT 'draft',
	`sent_count` integer DEFAULT 0,
	`total_contacts` integer DEFAULT 0,
	`daily_limit` integer DEFAULT 20,
	`scheduled_at` text,
	`created_at` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_marketing_campaigns_status` ON `marketing_campaigns` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_marketing_campaigns_store` ON `marketing_campaigns` (`store_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `campaign_sends` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer NOT NULL REFERENCES `marketing_campaigns`(`id`),
	`contact_id` integer NOT NULL REFERENCES `marketing_contacts`(`id`),
	`to_email` text NOT NULL,
	`status` text DEFAULT 'queued',
	`sent_at` text,
	`error_message` text,
	`created_at` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_campaign_sends_campaign` ON `campaign_sends` (`campaign_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_campaign_sends_contact` ON `campaign_sends` (`contact_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_campaign_sends_status` ON `campaign_sends` (`status`);
