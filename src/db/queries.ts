import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "./client";
import {
  articleQuotes,
  articles,
  generationRequests,
  storyIdeas,
} from "./schema";

// Read-side helpers for the future authenticated CMS dashboard.
// No public mutation endpoints are exposed in this phase.
export async function listReviewInbox() {
  const db = await getDb();
  return db
    .select()
    .from(articles)
    .where(
      inArray(articles.status, [
        "draft",
        "in_review",
        "changes_requested",
        "approved",
      ]),
    )
    .orderBy(desc(articles.updatedAt));
}

export async function listGeneratedJobs() {
  const db = await getDb();
  return db
    .select()
    .from(generationRequests)
    .orderBy(desc(generationRequests.createdAt));
}

export async function listDiscoveredIdeas() {
  const db = await getDb();
  return db
    .select()
    .from(storyIdeas)
    .where(eq(storyIdeas.status, "new"))
    .orderBy(desc(storyIdeas.discoveredAt));
}

export async function getUnverifiedQuotes(articleId: string) {
  const db = await getDb();
  const quotes = await db
    .select()
    .from(articleQuotes)
    .where(eq(articleQuotes.articleId, articleId));
  return quotes.filter((quote) => quote.verificationStatus !== "verified");
}

export async function listPublishedArticles() {
  const db = await getDb();
  return db
    .select()
    .from(articles)
    .where(eq(articles.status, "published"))
    .orderBy(desc(articles.publishedAt));
}
