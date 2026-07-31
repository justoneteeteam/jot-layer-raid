CREATE TABLE `bulk_job_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`mockup_template_id` integer NOT NULL,
	`gender` text NOT NULL,
	`color` text,
	`status` text DEFAULT 'pending',
	`generated_image_url` text,
	`product_title` text,
	`product_description` text,
	`product_category` text,
	`store_product_ids` text,
	`error_message` text,
	FOREIGN KEY (`job_id`) REFERENCES `bulk_jobs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mockup_template_id`) REFERENCES `mockup_templates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `bulk_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`status` text DEFAULT 'pending',
	`total_items` integer DEFAULT 0,
	`completed_items` integer DEFAULT 0,
	`failed_items` integer DEFAULT 0,
	`store_targets` text,
	`seo_template` text,
	`created_at` text,
	`completed_at` text
);
--> statement-breakpoint
CREATE TABLE `fonts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`file_url` text NOT NULL,
	`preview_url` text,
	`category` text DEFAULT 'NFL',
	`team_id` integer,
	`jersey_type` text,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `leagues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo_url` text
);
--> statement-breakpoint
CREATE TABLE `mockup_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer,
	`name` text NOT NULL,
	`color_variant` text,
	`original_image_url` text,
	`font_config` text,
	`canvas_json` text,
	`background_color` text DEFAULT '#e5e7eb',
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`store_id` text,
	`order_id` text,
	`order_name` text,
	`customer_name` text NOT NULL,
	`customer_address` text NOT NULL,
	`customer_email` text,
	`product_name` text NOT NULL,
	`product_image` text,
	`quantity` integer DEFAULT 1,
	`variant` text,
	`variant_value` text,
	`revenue` real DEFAULT 0,
	`cost` real DEFAULT 0,
	`shipping_status` text DEFAULT 'placed',
	`tracking_number` text,
	`email_sent` integer DEFAULT false,
	`tracking_email_sent` integer DEFAULT false,
	`created_at` text,
	`synced_at` text
);
--> statement-breakpoint
CREATE TABLE `patches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`image_url` text NOT NULL,
	`width` integer,
	`height` integer
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`name` text NOT NULL,
	`display_name` text NOT NULL,
	`number` integer NOT NULL,
	`type` text DEFAULT 'Current',
	`group` text DEFAULT 'Football',
	`is_active` integer DEFAULT true,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `roster_changes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`player_name` text NOT NULL,
	`player_number` integer NOT NULL,
	`change_type` text NOT NULL,
	`source` text DEFAULT 'csv',
	`status` text DEFAULT 'pending',
	`diff_data` text,
	`detected_at` text,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `stores` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`platform` text NOT NULL,
	`url` text NOT NULL,
	`api_key` text NOT NULL,
	`api_secret` text NOT NULL,
	`is_active` integer DEFAULT true,
	`last_synced_at` text,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `synced_products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`platform_product_id` text,
	`platform` text NOT NULL,
	`image_url` text,
	`price` real DEFAULT 0,
	`sku` text,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`league_id` integer NOT NULL,
	`name` text NOT NULL,
	`region` text,
	`slug` text NOT NULL,
	`primary_color` text,
	`secondary_color` text,
	`logo_url` text,
	`yahoo_roster_url` text,
	FOREIGN KEY (`league_id`) REFERENCES `leagues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_name` text NOT NULL,
	`customer_email` text NOT NULL,
	`subject` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'open',
	`replies` text DEFAULT '[]',
	`recipient_email` text,
	`tags` text DEFAULT '',
	`snoozed_until` text,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`hashed_password` text NOT NULL,
	`created_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `leagues_name_unique` ON `leagues` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `leagues_slug_unique` ON `leagues` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `teams_slug_unique` ON `teams` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);