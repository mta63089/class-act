import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

// Application IDs are generated with crypto.randomUUID(). Timestamps are UTC
// SQLite timestamps; no authenticated/editorial write routes exist yet.
const now = sql`CURRENT_TIMESTAMP`;

export const ARTICLE_STATUSES = [
  "draft", "in_review", "changes_requested", "approved",
  "scheduled", "published", "archived",
] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export const IDEA_STATUSES = ["new", "selected", "dismissed", "drafted"] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];
export const JOB_STATUSES = ["queued", "running", "completed", "failed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
export const QUOTE_STATUSES = ["unverified", "verified", "rejected"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export type ArticleBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string; level: 2 | 3 }
  | { type: "quote"; quoteId: string; text: string; attribution: string }
  | { type: "list"; items: string[] };

export const cmsUsers = sqliteTable("cms_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["admin", "editor"] }).notNull().default("editor"),
  createdAt: text("created_at").notNull().default(now),
}, (table) => [uniqueIndex("cms_users_email_unique").on(table.email)]);

export const editorialProfiles = sqliteTable("editorial_profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  writingInstructions: text("writing_instructions").notNull(),
  defaultFraming: text("default_framing"),
  requireCitations: integer("require_citations", { mode: "boolean" }).notNull().default(true),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(now),
  updatedAt: text("updated_at").notNull().default(now),
});

export const newsSources = sqliteTable("news_sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  homepageUrl: text("homepage_url"),
  feedUrl: text("feed_url"),
  method: text("method", { enum: ["rss", "api", "html", "manual"] }).notNull().default("rss"),
  isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
  pollIntervalMinutes: integer("poll_interval_minutes").notNull().default(60),
  editorialPriority: integer("editorial_priority").notNull().default(0),
  lastFetchedAt: text("last_fetched_at"),
  createdAt: text("created_at").notNull().default(now),
  updatedAt: text("updated_at").notNull().default(now),
});

export const scrapeRuns = sqliteTable("scrape_runs", {
  id: text("id").primaryKey(),
  sourceId: text("source_id").references(() => newsSources.id, { onDelete: "set null" }),
  status: text("status", { enum: ["running", "completed", "failed"] }).notNull(),
  discoveredCount: integer("discovered_count").notNull().default(0),
  errorMessage: text("error_message"),
  startedAt: text("started_at").notNull().default(now),
  completedAt: text("completed_at"),
}, (table) => [index("scrape_runs_source_started_idx").on(table.sourceId, table.startedAt)]);

export const storyIdeas = sqliteTable("story_ideas", {
  id: text("id").primaryKey(),
  headline: text("headline").notNull(),
  summary: text("summary").notNull(),
  suggestedAngle: text("suggested_angle"),
  section: text("section"),
  sourceId: text("source_id").references(() => newsSources.id, { onDelete: "set null" }),
  sourceUrl: text("source_url"),
  // Hash or provider key for cross-run deduplication.
  fingerprint: text("fingerprint"),
  status: text("status", { enum: IDEA_STATUSES }).notNull().default("new"),
  discoveredAt: text("discovered_at").notNull().default(now),
  updatedAt: text("updated_at").notNull().default(now),
}, (table) => [
  uniqueIndex("story_ideas_fingerprint_unique").on(table.fingerprint),
  index("story_ideas_status_discovered_idx").on(table.status, table.discoveredAt),
]);

export const generationRequests = sqliteTable("generation_requests", {
  id: text("id").primaryKey(),
  origin: text("origin", { enum: ["manual", "story_idea"] }).notNull(),
  requestedById: text("requested_by_id").references(() => cmsUsers.id, { onDelete: "set null" }),
  ideaId: text("idea_id").references(() => storyIdeas.id, { onDelete: "set null" }),
  profileId: text("profile_id").references(() => editorialProfiles.id, { onDelete: "set null" }),
  topicPrompt: text("topic_prompt").notNull(),
  requestedFraming: text("requested_framing"),
  additionalInstructions: text("additional_instructions"),
  status: text("status", { enum: JOB_STATUSES }).notNull().default("queued"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull().default(now),
  completedAt: text("completed_at"),
}, (table) => [index("generation_requests_status_created_idx").on(table.status, table.createdAt)]);

export const articles = sqliteTable("articles", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  section: text("section").notNull(),
  kind: text("kind").notNull().default("News Analysis"),
  title: text("title").notNull(),
  dek: text("dek").notNull().default(""),
  body: text("body", { mode: "json" }).$type<ArticleBlock[]>().notNull().default(sql`'[]'`),
  image: text("image"),
  imageAlt: text("image_alt"),
  status: text("status", { enum: ARTICLE_STATUSES }).notNull().default("draft"),
  createdById: text("created_by_id").references(() => cmsUsers.id, { onDelete: "set null" }),
  generationRequestId: text("generation_request_id").references(() => generationRequests.id, { onDelete: "set null" }),
  createdWithAi: integer("created_with_ai", { mode: "boolean" }).notNull().default(false),
  currentVersion: integer("current_version").notNull().default(1),
  approvedVersion: integer("approved_version"),
  reviewedById: text("reviewed_by_id").references(() => cmsUsers.id, { onDelete: "set null" }),
  reviewedAt: text("reviewed_at"),
  scheduledFor: text("scheduled_for"),
  publishedAt: text("published_at"),
  createdAt: text("created_at").notNull().default(now),
  updatedAt: text("updated_at").notNull().default(now),
}, (table) => [
  uniqueIndex("articles_slug_unique").on(table.slug),
  index("articles_status_updated_idx").on(table.status, table.updatedAt),
  index("articles_published_at_idx").on(table.publishedAt),
]);

// Immutable snapshots allow an editor to compare AI drafts, manual edits,
// and revision suggestions before approval.
export const articleVersions = sqliteTable("article_versions", {
  id: text("id").primaryKey(),
  articleId: text("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  title: text("title").notNull(),
  dek: text("dek").notNull(),
  body: text("body", { mode: "json" }).$type<ArticleBlock[]>().notNull(),
  origin: text("origin", { enum: ["ai", "editor", "manual"] }).notNull(),
  changeSummary: text("change_summary"),
  createdById: text("created_by_id").references(() => cmsUsers.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull().default(now),
}, (table) => [uniqueIndex("article_versions_article_version_unique").on(table.articleId, table.version)]);

export const articleSources = sqliteTable("article_sources", {
  id: text("id").primaryKey(),
  articleId: text("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  title: text("title").notNull(),
  publisher: text("publisher"),
  publishedAt: text("published_at"),
  retrievedAt: text("retrieved_at").notNull().default(now),
  notes: text("notes"),
}, (table) => [index("article_sources_article_idx").on(table.articleId)]);

// Quoted statements must have traceable sources and review status. AI output
// never marks a quote verified automatically.
export const articleQuotes = sqliteTable("article_quotes", {
  id: text("id").primaryKey(),
  articleId: text("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  sourceId: text("source_id").references(() => articleSources.id, { onDelete: "set null" }),
  speaker: text("speaker").notNull(),
  exactText: text("exact_text").notNull(),
  contextNotes: text("context_notes"),
  originalUrl: text("original_url").notNull(),
  verificationStatus: text("verification_status", { enum: QUOTE_STATUSES }).notNull().default("unverified"),
  verifiedById: text("verified_by_id").references(() => cmsUsers.id, { onDelete: "set null" }),
  verifiedAt: text("verified_at"),
}, (table) => [index("article_quotes_article_idx").on(table.articleId)]);

export const reviewComments = sqliteTable("review_comments", {
  id: text("id").primaryKey(),
  articleId: text("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  articleVersion: integer("article_version").notNull(),
  createdById: text("created_by_id").references(() => cmsUsers.id, { onDelete: "set null" }),
  type: text("type", { enum: ["editor_note", "ai_revision_request", "ai_revision_response"] }).notNull(),
  message: text("message").notNull(),
  createdAt: text("created_at").notNull().default(now),
}, (table) => [index("review_comments_article_created_idx").on(table.articleId, table.createdAt)]);

export const automationSettings = sqliteTable("automation_settings", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(false),
  cronExpression: text("cron_expression").notNull(),
  maxIdeasPerRun: integer("max_ideas_per_run").notNull().default(20),
  maxDraftsPerRun: integer("max_drafts_per_run").notNull().default(3),
  profileId: text("profile_id").references(() => editorialProfiles.id, { onDelete: "set null" }),
  topicRules: text("topic_rules", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  // In the initial release no automation may publish without a human review.
  requireHumanReview: integer("require_human_review", { mode: "boolean" }).notNull().default(true),
  updatedAt: text("updated_at").notNull().default(now),
  updatedById: text("updated_by_id").references(() => cmsUsers.id, { onDelete: "set null" }),
}, (table) => [uniqueIndex("automation_settings_name_unique").on(table.name)]);

export const editorialEvents = sqliteTable("editorial_events", {
  id: text("id").primaryKey(),
  articleId: text("article_id").notNull().references(() => articles.id, { onDelete: "cascade" }),
  actorId: text("actor_id").references(() => cmsUsers.id, { onDelete: "set null" }),
  event: text("event").notNull(),
  details: text("details", { mode: "json" }).$type<Record<string, unknown>>(),
  occurredAt: text("occurred_at").notNull().default(now),
}, (table) => [index("editorial_events_article_date_idx").on(table.articleId, table.occurredAt)]);
