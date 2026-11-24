-- Calibration tables deliberately separate from production editorial tables.
-- All schema changes are additive; no existing account, idea or article is altered.
-- This migration is maintained manually (the calibration tables are not in Drizzle schema.ts).
CREATE TABLE IF NOT EXISTS `ai_calibrations` (
  `request_id` text PRIMARY KEY NOT NULL REFERENCES `generation_requests`(`id`) ON DELETE CASCADE,
  `research_status` text NOT NULL DEFAULT 'none' CHECK (`research_status` IN ('none','running','completed','failed')),
  `research_notes` text,
  `sources_json` text NOT NULL DEFAULT '[]',
  `writing_status` text NOT NULL DEFAULT 'none' CHECK (`writing_status` IN ('none','running','completed','failed')),
  `article_id` text REFERENCES `articles`(`id`) ON DELETE SET NULL,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ai_calibration_calls` (
  `id` text PRIMARY KEY NOT NULL,
  `request_id` text NOT NULL REFERENCES `generation_requests`(`id`) ON DELETE CASCADE,
  `stage` text NOT NULL CHECK (`stage` IN ('research','writing')),
  `model` text NOT NULL,
  `status` text NOT NULL CHECK (`status` IN ('completed','incomplete','failed')),
  `response_id` text,
  `input_tokens` integer,
  `output_tokens` integer,
  `reasoning_tokens` integer,
  `cached_input_tokens` integer,
  `web_calls` integer NOT NULL DEFAULT 0,
  `estimated_usd` real,
  `reason` text,
  `raw_text` text,
  `duration_ms` integer NOT NULL DEFAULT 0,
  `created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ai_calibration_calls_request_idx` ON `ai_calibration_calls` (`request_id`, `created_at`);
