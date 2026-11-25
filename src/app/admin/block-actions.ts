"use server";

import { getDb } from "@/db/client";
import {
  articleQuotes,
  articles,
  articleSources,
  articleVersions,
  editorialEvents,
} from "@/db/schema";
import { requireEditorForAction } from "@/lib/admin";
import { validateArticleBlocks } from "@/lib/article-blocks";
import { estimateCost } from "@/lib/calibration-openai";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function validId(value: unknown) {
  const id = String(value || "");
  if (!/^[\da-f]{8}-[\da-f-]{27,40}$/i.test(id))
    throw new Error("Invalid article ID");
  return id;
}
function text(value: unknown, field: string, max: number) {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error(`Invalid ${field}`);
  return value.trim();
}

export async function saveBlockRevision(form: FormData) {
  const editor = await requireEditorForAction();
  const id = validId(form.get("id"));
  const title = text(form.get("title"), "headline", 200);
  const dek = text(form.get("dek"), "description", 600);
  const version = Number(form.get("version"));
  if (!Number.isSafeInteger(version) || version < 1)
    throw new Error("Invalid version");
  const raw = text(form.get("blocks"), "article blocks", 240000);
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("Article blocks are not valid JSON");
  }
  const body = validateArticleBlocks(value);
  if (body.every((block) => block.type === "imageIdea"))
    throw new Error("The article needs reporting text.");
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);
  if (
    !existing ||
    !["draft", "in_review", "changes_requested", "approved"].includes(
      existing.status,
    )
  )
    throw new Error("This article is no longer editable");
  if (existing.currentVersion !== version)
    throw new Error(
      "This article changed in another tab. Refresh before saving.",
    );
  const sources = await db
    .select({ id: articleSources.id })
    .from(articleSources)
    .where(eq(articleSources.articleId, id));
  for (const block of body) {
    const content =
      block.type === "paragraph" ||
      block.type === "heading" ||
      block.type === "pullquote" ||
      block.type === "quote" ||
      block.type === "split"
        ? block.text
        : block.type === "list"
          ? block.items.join(" ")
          : "";
    for (const found of content.matchAll(/\[(\d{1,2})\]/g)) {
      const number = Number(found[1]);
      if (number === 0 || number > sources.length)
        throw new Error(`Missing source for citation [${number}]`);
    }
  }
  const now = new Date().toISOString();
  const nextVersion = version + 1;
  const [updated] = await db
    .update(articles)
    .set({
      title,
      dek,
      body,
      status: "in_review",
      currentVersion: nextVersion,
      approvedVersion: null,
      reviewedById: null,
      reviewedAt: null,
      updatedAt: now,
    })
    .where(and(eq(articles.id, id), eq(articles.currentVersion, version)))
    .returning({ id: articles.id });
  if (!updated)
    throw new Error("Article changed while saving. Refresh and try again.");
  await db
    .update(articleQuotes)
    .set({
      verificationStatus: "unverified",
      verifiedById: null,
      verifiedAt: null,
    })
    .where(eq(articleQuotes.articleId, id));
  await db.insert(articleVersions).values({
    id: crypto.randomUUID(),
    articleId: id,
    version: nextVersion,
    title,
    dek,
    body,
    origin: "editor",
    createdById: editor.id,
    changeSummary: "Edited in live block preview",
  });
  await db.insert(editorialEvents).values({
    id: crypto.randomUUID(),
    articleId: id,
    actorId: editor.id,
    event: "block_editor_revision",
    details: { fromVersion: version, toVersion: nextVersion },
  });
  revalidatePath(`/admin/articles/${id}`);
  revalidatePath("/admin/inbox");
  return { ok: true as const, version: nextVersion };
}

/** One low-cost request rewrites only one selected block, returning an uncommitted suggestion. */
export async function proposeBlockRewrite(input: {
  articleId: string;
  version: number;
  blockIndex: number;
  text: string;
  instruction: string;
}): Promise<{ text: string; estimatedUsd: number | null }> {
  const editor = await requireEditorForAction();
  const id = validId(input.articleId);
  if (process.env.AI_PROVIDER !== "openai")
    throw new Error("AI rewriting requires AI_PROVIDER=openai.");
  const bodyText = text(input.text, "block text", 6000);
  const instruction = text(input.instruction, "rewrite instructions", 1500);
  const db = await getDb();
  const [article] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);
  if (
    !article ||
    article.currentVersion !== input.version ||
    !["draft", "in_review", "changes_requested", "approved"].includes(
      article.status,
    )
  )
    throw new Error(
      "This article was changed or cannot be edited. No API request made.",
    );
  const block = article.body[input.blockIndex];
  if (!block || !["paragraph", "heading", "split"].includes(block.type))
    throw new Error("Only text blocks can be rewritten. No API request made.");
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing. No API request made.");
  const model = process.env.OPENAI_REVISION_MODEL || "gpt-5.4-mini";
  // No web tool. No multi-stage research. One explicit click = one low-cost call.
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      reasoning: { effort: "low" },
      max_output_tokens: 6000,
      instructions:
        "You revise one block of a sourced news article. Follow the editor's instructions. Preserve every factual claim and inline [N] citation exactly unless the editor explicitly asks to remove a claim. Do not add new facts, direct quotes, references, or citation numbers. Return only the replacement block text, no markdown or preface.",
      input: `EDITOR INSTRUCTION:\n${instruction}\n\nORIGINAL TEXT:\n${bodyText}`,
    }),
    signal: AbortSignal.timeout(180000),
  });
  let data: {
    status?: string;
    incomplete_details?: { reason?: string };
    error?: { message?: string };
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      output_tokens_details?: { reasoning_tokens?: number };
    };
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  } = {};
  try {
    data = await response.json();
  } catch {
    /* handled below */
  }
  const raw =
    data.output
      ?.flatMap((x) =>
        x.type === "message"
          ? (x.content || [])
              .filter((c) => c.type === "output_text")
              .map((c) => c.text || "")
          : [],
      )
      .join("\n")
      .trim() || "";
  const usage = data.usage;
  const estimatedUsd = estimateCost(
    model,
    usage?.input_tokens ?? null,
    usage?.output_tokens ?? null,
    0,
  );
  try {
    await db.insert(editorialEvents).values({
      id: crypto.randomUUID(),
      articleId: id,
      actorId: editor.id,
      event: "block_rewrite_request",
      details: {
        version: input.version,
        blockIndex: input.blockIndex,
        model,
        status: data.status || `http_${response.status}`,
        inputTokens: usage?.input_tokens ?? null,
        outputTokens: usage?.output_tokens ?? null,
        reasoningTokens: usage?.output_tokens_details?.reasoning_tokens ?? null,
        estimatedUsd,
      },
    });
  } catch (error) {
    console.error("Could not log rewrite usage", error);
  }
  if (!response.ok || data.status !== "completed")
    throw new Error(
      `Rewrite did not complete: ${data.incomplete_details?.reason || data.error?.message || data.status || response.status}. This request may have been billed.`,
    );
  if (raw.length < 10 || raw.length > 6000)
    throw new Error(
      "Rewrite produced unusable output; the original block is unchanged.",
    );
  return { text: raw, estimatedUsd };
}

/** Soft scrap: preserves audit trail, history, and any billable receipts. */
export async function scrapUnpublishedArticle(id: string) {
  const editor = await requireEditorForAction();
  const articleId = validId(id);
  const db = await getDb();
  const [article] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);
  if (
    !article ||
    !["draft", "in_review", "changes_requested", "approved"].includes(
      article.status,
    )
  )
    throw new Error("Only unpublished drafts can be scrapped.");
  await db
    .update(articles)
    .set({
      status: "archived",
      approvedVersion: null,
      reviewedAt: null,
      reviewedById: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(articles.id, articleId));
  await db.insert(editorialEvents).values({
    id: crypto.randomUUID(),
    articleId,
    actorId: editor.id,
    event: "article_scrapped",
  });
  revalidatePath("/admin/inbox");
  revalidatePath("/admin/articles");
  redirect("/admin/articles");
}
