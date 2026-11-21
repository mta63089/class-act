CREATE TABLE `article_quotes` (
	`id` text PRIMARY KEY NOT NULL,
	`article_id` text NOT NULL,
	`source_id` text,
	`speaker` text NOT NULL,
	`exact_text` text NOT NULL,
	`context_notes` text,
	`original_url` text NOT NULL,
	`verification_status` text DEFAULT 'unverified' NOT NULL,
	`verified_by_id` text,
	`verified_at` text,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_id`) REFERENCES `article_sources`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`verified_by_id`) REFERENCES `cms_users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `article_quotes_article_idx` ON `article_quotes` (`article_id`);--> statement-breakpoint
CREATE TABLE `article_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`article_id` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`publisher` text,
	`published_at` text,
	`retrieved_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`notes` text,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `article_sources_article_idx` ON `article_sources` (`article_id`);--> statement-breakpoint
CREATE TABLE `article_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`article_id` text NOT NULL,
	`version` integer NOT NULL,
	`title` text NOT NULL,
	`dek` text NOT NULL,
	`body` text NOT NULL,
	`origin` text NOT NULL,
	`change_summary` text,
	`created_by_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_id`) REFERENCES `cms_users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `article_versions_article_version_unique` ON `article_versions` (`article_id`,`version`);--> statement-breakpoint
CREATE TABLE `articles` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`section` text NOT NULL,
	`kind` text DEFAULT 'News Analysis' NOT NULL,
	`title` text NOT NULL,
	`dek` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '[]' NOT NULL,
	`image` text,
	`image_alt` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by_id` text,
	`generation_request_id` text,
	`created_with_ai` integer DEFAULT false NOT NULL,
	`current_version` integer DEFAULT 1 NOT NULL,
	`approved_version` integer,
	`reviewed_by_id` text,
	`reviewed_at` text,
	`scheduled_for` text,
	`published_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`created_by_id`) REFERENCES `cms_users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`generation_request_id`) REFERENCES `generation_requests`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reviewed_by_id`) REFERENCES `cms_users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `articles_slug_unique` ON `articles` (`slug`);--> statement-breakpoint
CREATE INDEX `articles_status_updated_idx` ON `articles` (`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `articles_published_at_idx` ON `articles` (`published_at`);--> statement-breakpoint
CREATE TABLE `automation_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_enabled` integer DEFAULT false NOT NULL,
	`cron_expression` text NOT NULL,
	`max_ideas_per_run` integer DEFAULT 20 NOT NULL,
	`max_drafts_per_run` integer DEFAULT 3 NOT NULL,
	`profile_id` text,
	`topic_rules` text DEFAULT '[]' NOT NULL,
	`require_human_review` integer DEFAULT true NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by_id` text,
	FOREIGN KEY (`profile_id`) REFERENCES `editorial_profiles`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by_id`) REFERENCES `cms_users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `automation_settings_name_unique` ON `automation_settings` (`name`);--> statement-breakpoint
CREATE TABLE `cms_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'editor' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cms_users_email_unique` ON `cms_users` (`email`);--> statement-breakpoint
CREATE TABLE `editorial_events` (
	`id` text PRIMARY KEY NOT NULL,
	`article_id` text NOT NULL,
	`actor_id` text,
	`event` text NOT NULL,
	`details` text,
	`occurred_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `cms_users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `editorial_events_article_date_idx` ON `editorial_events` (`article_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `editorial_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`writing_instructions` text NOT NULL,
	`default_framing` text,
	`require_citations` integer DEFAULT true NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `generation_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`origin` text NOT NULL,
	`requested_by_id` text,
	`idea_id` text,
	`profile_id` text,
	`topic_prompt` text NOT NULL,
	`requested_framing` text,
	`additional_instructions` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`error_message` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`requested_by_id`) REFERENCES `cms_users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`idea_id`) REFERENCES `story_ideas`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`profile_id`) REFERENCES `editorial_profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `generation_requests_status_created_idx` ON `generation_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `news_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`homepage_url` text,
	`feed_url` text,
	`method` text DEFAULT 'rss' NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`poll_interval_minutes` integer DEFAULT 60 NOT NULL,
	`editorial_priority` integer DEFAULT 0 NOT NULL,
	`last_fetched_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `review_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`article_id` text NOT NULL,
	`article_version` integer NOT NULL,
	`created_by_id` text,
	`type` text NOT NULL,
	`message` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_id`) REFERENCES `cms_users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `review_comments_article_created_idx` ON `review_comments` (`article_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `scrape_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text,
	`status` text NOT NULL,
	`discovered_count` integer DEFAULT 0 NOT NULL,
	`error_message` text,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`source_id`) REFERENCES `news_sources`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `scrape_runs_source_started_idx` ON `scrape_runs` (`source_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `story_ideas` (
	`id` text PRIMARY KEY NOT NULL,
	`headline` text NOT NULL,
	`summary` text NOT NULL,
	`suggested_angle` text,
	`section` text,
	`source_id` text,
	`source_url` text,
	`fingerprint` text,
	`status` text DEFAULT 'new' NOT NULL,
	`discovered_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `news_sources`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `story_ideas_fingerprint_unique` ON `story_ideas` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `story_ideas_status_discovered_idx` ON `story_ideas` (`status`,`discovered_at`);