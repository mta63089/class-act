"use server";

import { getDb } from "@/db/client";
import { getPublicationBlockers } from "@/db/editorial-rules";
import { articleQuotes, articles, editorialEvents } from "@/db/schema";
import { requireEditorForAction } from "@/lib/admin";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function articleId(form: FormData) {
  const id = String(form.get("id") ?? "");
  if (!/^[\da-f-]{36}$/i.test(id)) throw new Error("Invalid article ID");
  return id;
}
function touchPaths(id: string, slug?: string) {
  revalidatePath("/admin/inbox");
  revalidatePath(`/admin/articles/${id}`);
  if (slug) revalidatePath(`/stories/${slug}`);
  revalidatePath("/");
  revalidatePath("/archive");
  revalidatePath("/sitemap.xml");
  revalidatePath("/feed.xml");
  for (const section of ["politics", "labor", "economy", "culture"])
    revalidatePath(`/sections/${section}`);
}
async function event(
  db: Awaited<ReturnType<typeof getDb>>,
  id: string,
  actorId: string,
  kind: string,
) {
  await db
    .insert(editorialEvents)
    .values({ id: crypto.randomUUID(), articleId: id, actorId, event: kind });
}

export async function setQuoteVerification(form: FormData) {
  const editor = await requireEditorForAction();
  const id = articleId(form);
  const quoteId = String(form.get("quoteId") ?? "");
  const status = String(form.get("verificationStatus") ?? "");
  if (
    !/^[\da-f-]{36}$/i.test(quoteId) ||
    !["verified", "rejected", "unverified"].includes(status)
  )
    throw new Error("Invalid quote review");
  const db = await getDb();
  const [article] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);
  if (!article || ["published", "archived"].includes(article.status))
    throw new Error("Quote review is closed");
  await db
    .update(articleQuotes)
    .set({
      verificationStatus: status as "verified" | "rejected" | "unverified",
      verifiedById: status === "verified" ? editor.id : null,
      verifiedAt: status === "verified" ? new Date().toISOString() : null,
    })
    .where(and(eq(articleQuotes.id, quoteId), eq(articleQuotes.articleId, id)));
  // A changed quote verification decision invalidates an earlier approval.
  await db
    .update(articles)
    .set({
      status: "in_review",
      approvedVersion: null,
      reviewedById: null,
      reviewedAt: null,
    })
    .where(eq(articles.id, id));
  await event(db, id, editor.id, `quote_${status}`);
  touchPaths(id);
  redirect(`/admin/articles/${id}`);
}

export async function approveDraft(form: FormData) {
  const editor = await requireEditorForAction();
  const id = articleId(form);
  const db = await getDb();
  const [article] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);
  if (
    !article ||
    !["draft", "in_review", "changes_requested", "approved"].includes(
      article.status,
    )
  )
    throw new Error("Cannot approve this article");
  if (!article.title.trim() || !article.dek.trim() || !article.body.length)
    throw new Error("Article is incomplete");
  if (article.body.some((block) => block.type === "imageIdea"))
    throw new Error("Resolve or remove all image briefs before approval");
  const paragraphs = article.body
    .filter((block) => block.type === "paragraph" || block.type === "split")
    .map((block) => block.text)
    .join(" ");
  for (const block of article.body)
    if (block.type === "pullquote" && !paragraphs.includes(block.text))
      throw new Error(
        "Highlighted pull quotes must repeat an excerpt of the article body",
      );
  const quotes = await db
    .select({ status: articleQuotes.verificationStatus })
    .from(articleQuotes)
    .where(eq(articleQuotes.articleId, id));
  if (quotes.some((q) => q.status !== "verified"))
    throw new Error("Verify or remove every quote before approving");
  const [updated] = await db
    .update(articles)
    .set({
      status: "approved",
      approvedVersion: article.currentVersion,
      reviewedById: editor.id,
      reviewedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(articles.id, id),
        eq(articles.currentVersion, article.currentVersion),
      ),
    )
    .returning({ id: articles.id });
  if (!updated) throw new Error("Article changed. Refresh the review page");
  await event(db, id, editor.id, "article_approved");
  touchPaths(id);
  redirect(`/admin/articles/${id}`);
}

export async function publishApproved(form: FormData) {
  const editor = await requireEditorForAction();
  const id = articleId(form);
  const db = await getDb();
  const [article] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);
  if (!article) throw new Error("Article not found");
  if (
    article.kind === "Demo Article" &&
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_DEMO_PUBLICATION !== "true"
  ) {
    throw new Error("Demo publication is disabled in production");
  }
  const quotes = await db
    .select({ status: articleQuotes.verificationStatus })
    .from(articleQuotes)
    .where(eq(articleQuotes.articleId, id));
  const blockers = getPublicationBlockers(
    article,
    quotes.map((q) => q.status),
  );
  if (blockers.length) throw new Error(blockers.join(" "));
  const now = new Date().toISOString();
  const [updated] = await db
    .update(articles)
    .set({ status: "published", publishedAt: now, updatedAt: now })
    .where(
      and(
        eq(articles.id, id),
        eq(articles.status, "approved"),
        eq(articles.currentVersion, article.approvedVersion!),
      ),
    )
    .returning({ id: articles.id });
  if (!updated) throw new Error("Article changed. Review it again");
  await event(db, id, editor.id, "article_published");
  touchPaths(id, article.slug);
  redirect(`/stories/${article.slug}`);
}
