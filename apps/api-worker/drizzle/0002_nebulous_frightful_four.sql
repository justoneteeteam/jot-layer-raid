CREATE TABLE `email_logs` (
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
CREATE TABLE `email_suppressions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`reason` text NOT NULL,
	`source` text DEFAULT 'system',
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `pinterest_content_types` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`niche_id` integer,
	`name` text NOT NULL,
	`description` text,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `pinterest_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`niche_id` integer,
	`trend_id` integer,
	`keyword` text NOT NULL,
	`theme` text,
	`style` text,
	`content_type` text,
	`recipe_name` text,
	`product` text,
	`prompt_used` text,
	`negative_prompt` text,
	`file_name` text,
	`seo_title` text,
	`seo_description` text,
	`seo_tags` text,
	`seo_alt_text` text,
	`model_used` text,
	`generation_time_ms` integer,
	`reference_image_url` text,
	`generated_image_url` text,
	`account_channel_id` text,
	`status` text DEFAULT 'completed',
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `pinterest_niches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`target_audience` text,
	`language` text DEFAULT 'English',
	`market` text DEFAULT 'United States',
	`ai_raw_response` text,
	`status` text DEFAULT 'draft',
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `pinterest_prompts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`niche_id` integer,
	`name` text NOT NULL,
	`style_description` text,
	`positive_prompt` text,
	`negative_prompt` text,
	`color_palette` text,
	`lighting_style` text,
	`camera_style` text,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `pinterest_recipes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`niche_id` integer,
	`content_type_id` integer,
	`name` text NOT NULL,
	`description` text,
	`prompt_template` text,
	`seo_direction` text,
	`visual_params` text,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `pinterest_theme_styles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`theme_id` integer NOT NULL,
	`style_id` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pinterest_themes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`niche_id` integer,
	`name` text NOT NULL,
	`description` text,
	`season` text,
	`decor_elements` text,
	`color_palette` text,
	`mood` text,
	`recommended_styles` text,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `pinterest_trends` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`niche_id` integer,
	`keyword` text NOT NULL,
	`theme` text,
	`style` text,
	`content_type` text,
	`product` text,
	`image_url` text,
	`status` text DEFAULT 'pending',
	`created_at` text
);
--> statement-breakpoint
ALTER TABLE `users` ADD `role` text DEFAULT 'admin';--> statement-breakpoint
CREATE INDEX `idx_email_logs_to_email` ON `email_logs` (`to_email`);--> statement-breakpoint
CREATE INDEX `idx_email_logs_status` ON `email_logs` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `email_suppressions_email_unique` ON `email_suppressions` (`email`);--> statement-breakpoint
CREATE INDEX `idx_suppressions_email` ON `email_suppressions` (`email`);--> statement-breakpoint
CREATE INDEX `idx_suppressions_reason` ON `email_suppressions` (`reason`);--> statement-breakpoint
CREATE INDEX `idx_pinterest_content_types_niche` ON `pinterest_content_types` (`niche_id`);--> statement-breakpoint
CREATE INDEX `idx_pinterest_history_keyword` ON `pinterest_history` (`keyword`);--> statement-breakpoint
CREATE INDEX `idx_pinterest_history_status` ON `pinterest_history` (`status`);--> statement-breakpoint
CREATE INDEX `idx_pinterest_history_niche` ON `pinterest_history` (`niche_id`);--> statement-breakpoint
CREATE INDEX `idx_pinterest_niches_status` ON `pinterest_niches` (`status`);--> statement-breakpoint
CREATE INDEX `idx_pinterest_prompts_niche` ON `pinterest_prompts` (`niche_id`);--> statement-breakpoint
CREATE INDEX `idx_pinterest_recipes_niche` ON `pinterest_recipes` (`niche_id`);--> statement-breakpoint
CREATE INDEX `idx_pinterest_recipes_content_type` ON `pinterest_recipes` (`content_type_id`);--> statement-breakpoint
CREATE INDEX `idx_pinterest_theme_styles_theme` ON `pinterest_theme_styles` (`theme_id`);--> statement-breakpoint
CREATE INDEX `idx_pinterest_theme_styles_style` ON `pinterest_theme_styles` (`style_id`);--> statement-breakpoint
CREATE INDEX `idx_pinterest_themes_niche` ON `pinterest_themes` (`niche_id`);--> statement-breakpoint
CREATE INDEX `idx_pinterest_trends_status` ON `pinterest_trends` (`status`);--> statement-breakpoint
CREATE INDEX `idx_pinterest_trends_niche` ON `pinterest_trends` (`niche_id`);--> statement-breakpoint
CREATE INDEX `idx_job_items_job` ON `bulk_job_items` (`job_id`);--> statement-breakpoint
CREATE INDEX `idx_job_items_player` ON `bulk_job_items` (`player_id`);--> statement-breakpoint
CREATE INDEX `idx_job_items_status` ON `bulk_job_items` (`status`);--> statement-breakpoint
CREATE INDEX `idx_bulk_jobs_status` ON `bulk_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `idx_fonts_team` ON `fonts` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_fonts_category` ON `fonts` (`category`);--> statement-breakpoint
CREATE INDEX `idx_leagues_slug` ON `leagues` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_templates_team` ON `mockup_templates` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_orders_store` ON `orders` (`store_id`);--> statement-breakpoint
CREATE INDEX `idx_orders_email` ON `orders` (`customer_email`);--> statement-breakpoint
CREATE INDEX `idx_orders_status` ON `orders` (`shipping_status`);--> statement-breakpoint
CREATE INDEX `idx_players_team` ON `players` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_players_active` ON `players` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_roster_changes_team` ON `roster_changes` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_roster_changes_status` ON `roster_changes` (`status`);--> statement-breakpoint
CREATE INDEX `idx_synced_platform` ON `synced_products` (`platform`);--> statement-breakpoint
CREATE INDEX `idx_synced_sku` ON `synced_products` (`sku`);--> statement-breakpoint
CREATE INDEX `idx_teams_slug` ON `teams` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_teams_league` ON `teams` (`league_id`);--> statement-breakpoint
CREATE INDEX `idx_tickets_status` ON `tickets` (`status`);--> statement-breakpoint
CREATE INDEX `idx_tickets_email` ON `tickets` (`customer_email`);