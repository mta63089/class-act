/**
 * One-click, two-stage article generation.
 * Reuses Phase 6's D1 checkpoints and response receipts. No new migration.
 * Never automatically retries an API call. A later user click resumes saved work.
 */
import "server-only";

import { getDb } from "@/db/client";
import { articles, editorialProfiles } from "@/db/schema";
import {
  getCalibration,
  getCalibrationDb,
  saveReceipt,
} from "@/lib/calibration-db";
import {
  executeStage,
  paidCallsEnabled,
  parseDraft,
  researchPrompt,
  writingPrompt,
  type DraftResult,
  type EvidenceSource,
} from "@/lib/calibration-openai";
import type { D1Database } from "@cloudflare/workers-types";
import { eq } from "drizzle-orm";

const errorText = (error: unknown) =>
  (error &&
  typeof error === "object" &&
  "message" in error &&
  typeof error.message === "string"
    ? error.message
    : "Unknown generation failure"
  ).slice(0, 450);

function slug(title: string, id: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
  return `${base || "article"}-${id.slice(0, 8)}`;
}

/** Preserve all article, sources, quotes, and status records in one atomic D1 batch. */
async function saveDraft(
  db: D1Database,
  args: {
    id: string;
    editorId: string;
    draft: DraftResult;
    sources: EvidenceSource[];
  },
): Promise<string> {
  const { id, editorId, draft, sources } = args;
  const articleId = crypto.randomUUID();
  const sourceIds = sources.map(() => crypto.randomUUID());
  // Image suggestions stay editor-only until a licensed or owned image is supplied.
  const content: Array<
    | { type: "paragraph"; text: string }
    | { type: "imageIdea"; prompt: string; placementNote: string }
  > = [];
  for (const [index, paragraph] of draft.paragraphs.entries()) {
    content.push({ type: "paragraph", text: paragraph });
    for (const idea of draft.visualBriefs || [])
      if (idea.afterParagraph === index)
        content.push({
          type: "imageIdea",
          prompt: idea.prompt,
          placementNote: `Photo search: ${idea.searchQuery}`,
        });
  }
  const body = JSON.stringify(content);

  await db.batch([
    db
      .prepare(
        `INSERT INTO articles
      (id,slug,section,kind,title,dek,body,status,created_by_id,generation_request_id,created_with_ai,current_version)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        articleId,
        slug(draft.title, articleId),
        draft.section,
        "News Analysis",
        draft.title,
        draft.dek,
        body,
        "in_review",
        editorId,
        id,
        1,
        1,
      ),
    db
      .prepare(
        `INSERT INTO article_versions
      (id,article_id,version,title,dek,body,origin,change_summary,created_by_id)
      VALUES (?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        articleId,
        1,
        draft.title,
        draft.dek,
        body,
        "ai",
        draft.changeSummary,
        editorId,
      ),
    ...sources.map((source, index) =>
      db
        .prepare(
          "INSERT INTO article_sources (id,article_id,url,title,notes) VALUES (?,?,?,?,?)",
        )
        .bind(
          sourceIds[index],
          articleId,
          source.url,
          source.title,
          `Source #${index + 1}: AI research; editorial verification required`,
        ),
    ),
    ...draft.quotes.map((quote) =>
      db
        .prepare(
          `INSERT INTO article_quotes
        (id,article_id,source_id,speaker,exact_text,context_notes,original_url,verification_status)
        VALUES (?,?,?,?,?,?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          articleId,
          sourceIds[quote.sourceNumber - 1],
          quote.speaker,
          quote.exactText,
          quote.contextNotes,
          sources[quote.sourceNumber - 1].url,
          "unverified",
        ),
    ),
    db
      .prepare(
        "INSERT INTO editorial_events (id,article_id,actor_id,event,details) VALUES (?,?,?,?,?)",
      )
      .bind(
        crypto.randomUUID(),
        articleId,
        editorId,
        "ai_draft_created",
        JSON.stringify({
          generationRequestId: id,
          sourceCount: sources.length,
          quoteCount: draft.quotes.length,
        }),
      ),
    db
      .prepare(
        "UPDATE ai_calibrations SET writing_status = 'completed', article_id = ?, updated_at = CURRENT_TIMESTAMP WHERE request_id = ?",
      )
      .bind(articleId, id),
    db
      .prepare(
        "UPDATE generation_requests SET status = 'completed', completed_at = CURRENT_TIMESTAMP, error_message = NULL WHERE id = ?",
      )
      .bind(id),
  ]);
  return articleId;
}

async function existingDraft(id: string): Promise<string | undefined> {
  const orm = await getDb();
  const [article] = await orm
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.generationRequestId, id))
    .limit(1);
  return article?.id;
}

async function failJob(
  db: D1Database,
  id: string,
  stage: "research" | "writing",
  reason: string,
) {
  const field = stage === "research" ? "research_status" : "writing_status";
  await db
    .prepare(
      `UPDATE ai_calibrations SET ${field} = 'failed', updated_at = CURRENT_TIMESTAMP WHERE request_id = ?`,
    )
    .bind(id)
    .run();
  await db
    .prepare(
      "UPDATE generation_requests SET status = 'failed', error_message = ? WHERE id = ?",
    )
    .bind(reason.slice(0, 450), id)
    .run();
}

function validSources(value: unknown): value is EvidenceSource[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (source) =>
        typeof source?.url === "string" &&
        /^https?:\/\//.test(source.url) &&
        typeof source?.title === "string",
    )
  );
}

/**
 * Called only from an authenticated CMS server action. The action is the single
 * user authorization; no additional checkboxes or calibration screen.
 */
export async function runLiveGeneration(
  id: string,
  editorId: string,
): Promise<string> {
  if (!paidCallsEnabled()) {
    throw new Error(
      "Live generation is not enabled. Set AI_PROVIDER=openai and remove any legacy AI_PAID_CALLS_ENABLED=false flag. No API call was made.",
    );
  }
  const db = await getCalibrationDb();
  const existing = await existingDraft(id);
  if (existing) return existing;

  // Claim the brief atomically so double-clicks and concurrent tabs cannot bill twice.
  const claim = await db
    .prepare(
      "UPDATE generation_requests SET status = 'running', error_message = NULL WHERE id = ? AND status IN ('queued','failed')",
    )
    .bind(id)
    .run();
  if (claim.meta.changes !== 1) {
    throw new Error(
      "This brief is already generating, completed, or unavailable. No API call was made.",
    );
  }

  let activeStage: "research" | "writing" = "research";
  try {
    const brief = await db
      .prepare(
        "SELECT topic_prompt, requested_framing, additional_instructions FROM generation_requests WHERE id = ?",
      )
      .bind(id)
      .first<{
        topic_prompt: string;
        requested_framing: string | null;
        additional_instructions: string | null;
      }>();
    if (!brief) throw new Error("Story brief not found.");

    await db
      .prepare("INSERT OR IGNORE INTO ai_calibrations (request_id) VALUES (?)")
      .bind(id)
      .run();
    let checkpoint = await getCalibration(db, id);
    if (!checkpoint)
      throw new Error("Research checkpoint could not be initialized.");

    // Research is always reused once completed. A previous failed writing call
    // can never cause another paid research call.
    if (checkpoint.research_status !== "completed") {
      if (checkpoint.research_status === "running") {
        throw new Error(
          "Research was already started. Check OpenAI usage before retrying this request.",
        );
      }
      const lock = await db
        .prepare(
          "UPDATE ai_calibrations SET research_status = 'running', updated_at = CURRENT_TIMESTAMP WHERE request_id = ? AND research_status IN ('none','failed') AND writing_status = 'none'",
        )
        .bind(id)
        .run();
      if (lock.meta.changes !== 1)
        throw new Error(
          "Research is already claimed or cannot safely restart.",
        );

      const prompt = researchPrompt({
        topic: brief.topic_prompt,
        framing: brief.requested_framing,
        instructions: brief.additional_instructions,
      });
      const { receipt, sources } = await executeStage(
        "research",
        prompt.instructions,
        prompt.input,
      );
      await saveReceipt(db, id, receipt);
      const usable =
        receipt.status === "completed" &&
        receipt.rawText.length >= 80 &&
        validSources(sources);
      // Always persist returned text and links, including an incomplete response.
      await db
        .prepare(
          `UPDATE ai_calibrations SET research_status = ?, research_notes = ?,
        sources_json = ?, updated_at = CURRENT_TIMESTAMP WHERE request_id = ?`,
        )
        .bind(
          usable ? "completed" : "failed",
          receipt.rawText,
          JSON.stringify(sources),
          id,
        )
        .run();
      if (!usable) {
        throw new Error(
          receipt.reason ||
            "Research did not finish with sufficient text and sources. Returned work was saved.",
        );
      }
      checkpoint = await getCalibration(db, id);
      if (!checkpoint)
        throw new Error("Saved research checkpoint could not be read.");
    }

    activeStage = "writing";
    if (
      !checkpoint.research_notes ||
      checkpoint.research_status !== "completed"
    ) {
      throw new Error(
        "Completed research notes were not saved. No writing API call was made.",
      );
    }
    let sources: EvidenceSource[];
    try {
      sources = JSON.parse(checkpoint.sources_json) as EvidenceSource[];
    } catch {
      throw new Error(
        "Saved research sources are not valid JSON. No writing API call was made.",
      );
    }
    if (!validSources(sources))
      throw new Error(
        "Saved research lacks sources. No writing API call was made.",
      );

    // On a previous DB failure, salvage a previously paid complete writing
    // response BEFORE considering any new writing API request.
    const saved = await db
      .prepare(
        `SELECT raw_text FROM ai_calibration_calls
      WHERE request_id = ? AND stage = 'writing' AND status = 'completed'
      ORDER BY created_at DESC, rowid DESC LIMIT 1`,
      )
      .bind(id)
      .first<{ raw_text: string | null }>();
    if (saved?.raw_text) {
      const recovered = parseDraft(saved.raw_text, sources);
      return await saveDraft(db, { id, editorId, draft: recovered, sources });
    }

    if (
      checkpoint.writing_status === "running" ||
      checkpoint.writing_status === "completed"
    ) {
      throw new Error(
        "Writing was already started; check the saved results before retrying. No new call was made.",
      );
    }
    const writingClaim = await db
      .prepare(
        `UPDATE ai_calibrations
      SET writing_status = 'running', updated_at = CURRENT_TIMESTAMP
      WHERE request_id = ? AND research_status = 'completed' AND writing_status IN ('none','failed')`,
      )
      .bind(id)
      .run();
    if (writingClaim.meta.changes !== 1)
      throw new Error(
        "Writing stage was already claimed. No new call was made.",
      );

    const orm = await getDb();
    const [profile] = await orm
      .select()
      .from(editorialProfiles)
      .where(eq(editorialProfiles.isDefault, true))
      .limit(1);
    const prompt = writingPrompt({
      topic: brief.topic_prompt,
      framing: brief.requested_framing,
      instructions: [
        profile?.writingInstructions,
        brief.additional_instructions,
      ]
        .filter(Boolean)
        .join("\n\n"),
      notes: checkpoint.research_notes,
      sources,
    });
    const { receipt } = await executeStage(
      "writing",
      prompt.instructions,
      prompt.input,
    );
    // Save every paid response. Invalid structured JSON is marked failed rather
    // than completed so later retries don't endlessly re-parse it as recoverable.
    if (receipt.status !== "completed") {
      await saveReceipt(db, id, receipt);
      throw new Error(
        receipt.reason ||
          "Writing did not complete. Research was saved; only writing needs retrying.",
      );
    }
    let draft: DraftResult;
    try {
      draft = parseDraft(receipt.rawText, sources);
    } catch (error) {
      await saveReceipt(db, id, {
        ...receipt,
        status: "failed",
        reason: errorText(error),
      });
      throw error;
    }
    // The completed response is retained before attempting the article DB batch.
    await saveReceipt(db, id, receipt);
    return await saveDraft(db, { id, editorId, draft, sources });
  } catch (error) {
    const reason = errorText(error);
    console.error(`Article generation ${activeStage} failure:`, reason);
    try {
      await failJob(db, id, activeStage, reason);
    } catch (persistError) {
      console.error(
        "Failed to persist generation error:",
        errorText(persistError),
      );
    }
    throw new Error(reason);
  }
}
