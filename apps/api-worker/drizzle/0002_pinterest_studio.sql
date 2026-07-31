CREATE TABLE `pinterest_trends` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `keyword` text NOT NULL,
  `theme` text,
  `style` text,
  `product` text,
  `image_url` text,
  `status` text DEFAULT 'pending',
  `created_at` text
);
--> statement-breakpoint
CREATE TABLE `pinterest_prompts` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
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
CREATE TABLE `pinterest_themes` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `season` text,
  `decor_elements` text,
  `color_palette` text,
  `mood` text,
  `recommended_styles` text,
  `created_at` text
);
--> statement-breakpoint
CREATE TABLE `pinterest_history` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `trend_id` integer,
  `keyword` text NOT NULL,
  `theme` text,
  `style` text,
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
  `status` text DEFAULT 'completed',
  `created_at` text
);
