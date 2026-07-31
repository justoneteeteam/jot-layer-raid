CREATE TABLE `email_sender_identities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`store_id` text NOT NULL,
	`provider` text NOT NULL,
	`from_name` text NOT NULL,
	`from_email` text NOT NULL,
	`reply_to_email` text,
	`domain` text NOT NULL,
	`status` text DEFAULT 'pending',
	`provider_config_ref` text,
	`created_at` text
);
