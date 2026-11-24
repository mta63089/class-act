"use server";

import { getDb } from "@/db/client";
import {
  articleQuotes,
  articles,
  articleSources,
  articleVersions,
  editorialEvents,
  editorialProfiles,
  generationRequests,
  reviewComments,
} from "@/db/schema";
import { requireEditorForAction } from "@/lib/admin";
import {
  asParagraphBlocks,
  editorialMode,
  generateArticle,
  reviseArticle,
} from "@/lib/ai-editorial";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function getField(form: FormData, name: string, max: number): string {
  const value = String(form.get(name) ?? "").trim();
  if (!value || value.length > max)
    throw new Error(`Please enter a valid ${name}.`);
  return value;
}

/** The form confirmation is checked server-side; a UI checkbox alone is not a spending guard. */
function sourceNumber(notes: string | null): number {
  const match = /^Source #(\d+):/.exec(notes || "");
  return match ? Number(match[1]) : 999;
}

function urlSlug(title: string, id: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
  return `${base || "story"}-${id.slice(0, 8)}`;
}

async function processGeneration(
  id: string,
): Promise<{ articleId?: string; failed: boolean }> {
  const editor = await requireEditorForAction();
  // Always block the legacy paid generation path. Calibration uses separate audited calls.
  if (editorialMode() === "openai") {
    throw new Error(
      "Live generation has moved to /admin/calibration. No API request was made.",
    );
  }
  const db = await getDb();
  const [job] = await db
    .update(generationRequests)
    .set({ status: "running", errorMessage: null, completedAt: null })
    .where(
      and(
        eq(generationRequests.id, id),
        inArray(generationRequests.status, ["queued", "failed"]),
      ),
    )
    .returning();
  if (!job) return { failed: true };

  try {
    // A rerun must not create another article if a previous attempt partly succeeded.
    const [existing] = await db
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.generationRequestId, id))
      .limit(1);
    if (existing) {
      throw new Error(
        "This request already has a draft. Review that draft instead of retrying.",
      );
    }
    const [profile] = await db
      .select()
      .from(editorialProfiles)
      .where(eq(editorialProfiles.isDefault, true))
      .limit(1);
    const result = await generateArticle({
      topic: job.topicPrompt,
      framing: job.requestedFraming,
      instructions: [profile?.writingInstructions, job.additionalInstructions]
        .filter(Boolean)
        .join("\n\n"),
    });
    const { draft, sources } = result;
    const articleId = crypto.randomUUID();
    const blocks = asParagraphBlocks(draft.paragraphs);
    await db.insert(articles).values({
      id: articleId,
      slug: urlSlug(draft.title, articleId),
      title: draft.title,
      dek: draft.dek,
      section: draft.section,
      kind: editorialMode() === "mock" ? "Demo Article" : "News Analysis",
      body: blocks,
      status: "in_review",
      createdById: editor.id,
      generationRequestId: id,
      createdWithAi: true,
      currentVersion: 1,
      approvedVersion: null,
    });
    await db.insert(articleVersions).values({
      id: crypto.randomUUID(),
      articleId,
      version: 1,
      title: draft.title,
      dek: draft.dek,
      body: blocks,
      origin: "ai",
      createdById: editor.id,
      changeSummary: draft.changeSummary || "Initial researched AI draft",
    });
    const sourceIds: string[] = [];
    for (const [index, source] of sources.entries()) {
      const sourceId = crypto.randomUUID();
      sourceIds.push(sourceId);
      await db.insert(articleSources).values({
        id: sourceId,
        articleId,
        url: source.url,
        title: source.title,
        notes: `Source #${index + 1}: AI web research; editorial verification required.`,
      });
    }
    for (const quote of draft.quotes) {
      await db.insert(articleQuotes).values({
        id: crypto.randomUUID(),
        articleId,
        sourceId: sourceIds[quote.sourceNumber - 1],
        speaker: quote.speaker,
        exactText: quote.exactText,
        contextNotes: quote.contextNotes,
        originalUrl: sources[quote.sourceNumber - 1].url,
        verificationStatus: "unverified",
      });
    }
    await db.insert(editorialEvents).values({
      id: crypto.randomUUID(),
      articleId,
      actorId: editor.id,
      event: "ai_draft_created",
      details: {
        generationRequestId: id,
        sourceCount: sources.length,
        quoteCount: draft.quotes.length,
      },
    });
    await db
      .update(generationRequests)
      .set({
        status: "completed",
        completedAt: new Date().toISOString(),
        errorMessage: null,
      })
      .where(eq(generationRequests.id, id));
    revalidatePath("/admin/inbox");
    revalidatePath("/admin/ideas");
    return { articleId, failed: false };
  } catch (error) {
    const description =
      error instanceof Error ? error.message : "Unknown generation error";
    console.error("Article generation failed:", description);
    await db
      .update(generationRequests)
      .set({ status: "failed", errorMessage: description.slice(0, 450) })
      .where(eq(generationRequests.id, id));
    revalidatePath("/admin/inbox");
    revalidatePath("/admin/ideas");
    return { failed: true };
  }
}

export async function generateFromBrief(form: FormData) {
  const editor = await requireEditorForAction();
  // This action only saves a brief in live mode; approval happens per paid stage.
  const topic = getField(form, "topic", 3000);
  const framing = String(form.get("framing") ?? "")
    .trim()
    .slice(0, 3000);
  const instructions = String(form.get("instructions") ?? "")
    .trim()
    .slice(0, 5000);
  const id = crypto.randomUUID();
  const db = await getDb();
  await db.insert(generationRequests).values({
    id,
    origin: "manual",
    requestedById: editor.id,
    topicPrompt: topic,
    requestedFraming: framing || null,
    additionalInstructions: instructions || null,
    status: "queued",
  });
  if (editorialMode() === "openai") redirect(`/admin/calibration/${id}`);
  const result = await processGeneration(id);
  if (result.articleId) redirect(`/admin/articles/${result.articleId}`);
  redirect("/admin/ideas?generation=failed");
}

export async function generateQueuedArticle(form: FormData) {
  await requireEditorForAction();
  const id = getField(form, "id", 64);
  if (editorialMode() === "openai") redirect(`/admin/calibration/${id}`);
  const result = await processGeneration(id);
  if (result.articleId) redirect(`/admin/articles/${result.articleId}`);
  redirect("/admin/ideas?generation=failed");
}

export async function reviseWithAi(form: FormData) {
  const editor = await requireEditorForAction();
  // Revision calibration is a later step; never make an unaudited live revision call.
  if (editorialMode() === "openai")
    throw new Error(
      "Paid revisions are disabled until they have their own audited calibration. No API call was made.",
    );
  const articleId = getField(form, "id", 64);
  const instruction = getField(form, "instruction", 3000);
  const db = await getDb();
  const [article] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);
  if (
    !article ||
    ["published", "archived", "scheduled"].includes(article.status)
  )
    throw new Error("This article cannot be revised.");
  if (editorialMode() === "mock" && article.kind !== "Demo Article")
    throw new Error(
      "Mock revisions are limited to demo articles. Edit this real draft manually.",
    );
  if (editorialMode() === "openai" && article.kind === "Demo Article")
    throw new Error("Switch to mock mode to revise demo articles.");
  if (!article.body.every((block) => block.type === "paragraph"))
    throw new Error("Structured editor required for this article.");
  const storedSources = await db
    .select()
    .from(articleSources)
    .where(eq(articleSources.articleId, articleId));
  const sources = storedSources
    .sort((a, b) => sourceNumber(a.notes) - sourceNumber(b.notes))
    .map((source) => ({ title: source.title, url: source.url }));
  const originalVersion = article.currentVersion;
  const revision = await reviseArticle({
    title: article.title,
    dek: article.dek,
    section: article.section,
    paragraphs: article.body.map((block) =>
      block.type === "paragraph" ? block.text : "",
    ),
    sources,
    instruction,
  });
  const body = asParagraphBlocks(revision.paragraphs);
  const nextVersion = originalVersion + 1;
  const [updated] = await db
    .update(articles)
    .set({
      title: revision.title,
      dek: revision.dek,
      body,
      status: "in_review",
      currentVersion: nextVersion,
      approvedVersion: null,
      reviewedById: null,
      reviewedAt: null,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(articles.id, articleId),
        eq(articles.currentVersion, originalVersion),
      ),
    )
    .returning({ id: articles.id });
  if (!updated)
    throw new Error("The draft changed in another tab. Refresh and try again.");
  await db.insert(articleVersions).values({
    id: crypto.randomUUID(),
    articleId,
    version: nextVersion,
    title: revision.title,
    dek: revision.dek,
    body,
    origin: "ai",
    createdById: editor.id,
    changeSummary: revision.changeSummary || "AI revision requested by editor",
  });
  await db.insert(reviewComments).values({
    id: crypto.randomUUID(),
    articleId,
    articleVersion: originalVersion,
    createdById: editor.id,
    type: "ai_revision_request",
    message: instruction,
  });
  await db.insert(editorialEvents).values({
    id: crypto.randomUUID(),
    articleId,
    actorId: editor.id,
    event: "ai_revision_created",
    details: { from: originalVersion, to: nextVersion },
  });
  revalidatePath(`/admin/articles/${articleId}`);
  revalidatePath("/admin/inbox");
  revalidatePath("/admin/ideas");
  redirect(`/admin/articles/${articleId}`);
}
