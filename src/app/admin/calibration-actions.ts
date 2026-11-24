"use server";

import { getDb } from "@/db/client";
import { articles, editorialProfiles } from "@/db/schema";
import { requireEditorForAction } from "@/lib/admin";
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
  type StageReceipt,
} from "@/lib/calibration-openai";
import type { D1Database } from "@cloudflare/workers-types";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function authorize(form: FormData): string {
  if (!paidCallsEnabled())
    throw new Error("Paid AI calls are disabled. No API request was made.");
  if (form.get("authorize") !== "yes")
    throw new Error(
      "Confirm this paid stage before proceeding. No API request was made.",
    );
  const id = String(form.get("id") || "").trim();
  if (!/^[a-zA-Z0-9-]{20,64}$/.test(id)) throw new Error("Invalid request ID");
  return id;
}
function shortError(error: unknown) {
  return (error instanceof Error ? error.message : "Unknown error").slice(
    0,
    500,
  );
}
async function failStage(
  db: D1Database,
  id: string,
  stage: "research" | "writing",
  reason: string,
) {
  const col = stage === "research" ? "research_status" : "writing_status";
  await db
    .prepare(
      `UPDATE ai_calibrations SET ${col} = 'failed', updated_at = CURRENT_TIMESTAMP WHERE request_id = ?`,
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
async function existingDraft(id: string) {
  const db = await getDb();
  const [found] = await db
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.generationRequestId, id))
    .limit(1);
  return found?.id;
}

/** One explicit research click = at most one paid request; never runs writing. */
export async function calibrateResearch(form: FormData) {
  await requireEditorForAction();
  const id = authorize(form);
  const db = await getCalibrationDb();
  const existing = await db
    .prepare(
      "SELECT id, topic_prompt, requested_framing, additional_instructions FROM generation_requests WHERE id = ?",
    )
    .bind(id)
    .first<{
      id: string;
      topic_prompt: string;
      requested_framing: string | null;
      additional_instructions: string | null;
    }>();
  if (!existing) throw new Error("Story brief not found");
  if (await existingDraft(id))
    redirect(`/admin/calibration/${id}?message=draft_exists`);
  await db
    .prepare("INSERT OR IGNORE INTO ai_calibrations (request_id) VALUES (?)")
    .bind(id)
    .run();
  // Atomic claim blocks duplicate clicks or concurrent browsers from double charging.
  const lock = await db
    .prepare(
      "UPDATE ai_calibrations SET research_status = 'running', updated_at = CURRENT_TIMESTAMP WHERE request_id = ? AND research_status IN ('none','failed') AND writing_status = 'none'",
    )
    .bind(id)
    .run();
  if (lock.meta.changes !== 1)
    redirect(`/admin/calibration/${id}?message=already_started`);

  try {
    const prompt = researchPrompt({
      topic: existing.topic_prompt,
      framing: existing.requested_framing,
      instructions: existing.additional_instructions,
    });
    const { receipt, sources } = await executeStage(
      "research",
      prompt.instructions,
      prompt.input,
    );
    const usable =
      receipt.status === "completed" &&
      receipt.rawText.length >= 80 &&
      sources.length > 0;
    const finalReceipt: StageReceipt = usable
      ? receipt
      : {
          ...receipt,
          status: receipt.status === "completed" ? "failed" : receipt.status,
          reason:
            receipt.reason ||
            "Research produced insufficient notes or no clickable source URLs",
        };
    // Preserve notes and links even on incomplete responses; do not allow writing from incomplete research.
    await saveReceipt(db, id, finalReceipt);
    await db
      .prepare(
        `UPDATE ai_calibrations
      SET research_status = ?, research_notes = ?, sources_json = ?, updated_at = CURRENT_TIMESTAMP WHERE request_id = ?`,
      )
      .bind(
        usable ? "completed" : "failed",
        receipt.rawText,
        JSON.stringify(sources),
        id,
      )
      .run();
    await db
      .prepare(
        "UPDATE generation_requests SET status = ?, error_message = ? WHERE id = ?",
      )
      .bind(
        usable ? "queued" : "failed",
        usable ? null : finalReceipt.reason?.slice(0, 450) || "Research failed",
        id,
      )
      .run();
  } catch (error) {
    const reason = shortError(error);
    console.error("Calibration research failed", reason);
    await failStage(db, id, "research", reason);
  }
  revalidatePath(`/admin/calibration/${id}`);
  redirect(`/admin/calibration/${id}`);
}

function slug(title: string, id: string) {
  const name = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
  return `${name || "article"}-${id.slice(0, 8)}`;
}
/** D1 batch is atomic; a partial article must never be exposed. */
async function saveDraft(
  db: D1Database,
  args: {
    id: string;
    editorId: string;
    draft: DraftResult;
    sources: EvidenceSource[];
  },
) {
  const { id, editorId, draft, sources } = args;
  const articleId = crypto.randomUUID();
  const blocks = draft.paragraphs.map((text) => ({ type: "paragraph", text }));
  const sourceIds = sources.map(() => crypto.randomUUID());
  const queries = [
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
        JSON.stringify(blocks),
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
        JSON.stringify(blocks),
        "ai",
        draft.changeSummary,
        editorId,
      ),
    ...sources.map((s, i) =>
      db
        .prepare(
          `INSERT INTO article_sources (id,article_id,url,title,notes) VALUES (?,?,?,?,?)`,
        )
        .bind(
          sourceIds[i],
          articleId,
          s.url,
          s.title,
          `Source #${i + 1}: calibration research, editorial review required`,
        ),
    ),
    ...draft.quotes.map((q) =>
      db
        .prepare(
          `INSERT INTO article_quotes
      (id,article_id,source_id,speaker,exact_text,context_notes,original_url,verification_status)
      VALUES (?,?,?,?,?,?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          articleId,
          sourceIds[q.sourceNumber - 1],
          q.speaker,
          q.exactText,
          q.contextNotes,
          sources[q.sourceNumber - 1].url,
          "unverified",
        ),
    ),
    db
      .prepare(
        `INSERT INTO editorial_events (id,article_id,actor_id,event,details) VALUES (?,?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        articleId,
        editorId,
        "calibrated_ai_draft",
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
  ];
  await db.batch(queries);
  return articleId;
}

/** A second deliberate, separately confirmed click; reuses saved research. */
export async function calibrateWriting(form: FormData) {
  const editor = await requireEditorForAction();
  const id = authorize(form);
  const db = await getCalibrationDb();
  const row = await db
    .prepare(
      "SELECT topic_prompt, requested_framing, additional_instructions FROM generation_requests WHERE id = ?",
    )
    .bind(id)
    .first<{
      topic_prompt: string;
      requested_framing: string | null;
      additional_instructions: string | null;
    }>();
  const calibration = await getCalibration(db, id);
  if (
    !row ||
    !calibration ||
    calibration.research_status !== "completed" ||
    !calibration.research_notes
  ) {
    throw new Error("Completed research required. No API call was made.");
  }
  if (await existingDraft(id))
    redirect(`/admin/calibration/${id}?message=draft_exists`);
  const sources = JSON.parse(calibration.sources_json) as EvidenceSource[];
  if (!Array.isArray(sources) || !sources.length)
    throw new Error("No saved source URLs; refusing to pay for writing.");
  const lock = await db
    .prepare(
      "UPDATE ai_calibrations SET writing_status = 'running', updated_at = CURRENT_TIMESTAMP WHERE request_id = ? AND writing_status IN ('none','failed') AND research_status = 'completed'",
    )
    .bind(id)
    .run();
  if (lock.meta.changes !== 1)
    redirect(`/admin/calibration/${id}?message=already_started`);
  await db
    .prepare(
      "UPDATE generation_requests SET status = 'running', error_message = NULL WHERE id = ?",
    )
    .bind(id)
    .run();

  try {
    const drizzleDb = await getDb();
    const [profile] = await drizzleDb
      .select()
      .from(editorialProfiles)
      .where(eq(editorialProfiles.isDefault, true))
      .limit(1);
    const prompt = writingPrompt({
      topic: row.topic_prompt,
      framing: row.requested_framing,
      instructions: [profile?.writingInstructions, row.additional_instructions]
        .filter(Boolean)
        .join("\n\n"),
      notes: calibration.research_notes,
      sources,
    });
    const { receipt } = await executeStage(
      "writing",
      prompt.instructions,
      prompt.input,
    );
    let draft: DraftResult | null = null;
    let finalReceipt = receipt;
    if (receipt.status === "completed") {
      try {
        draft = parseDraft(receipt.rawText, sources);
      } catch (error) {
        finalReceipt = {
          ...receipt,
          status: "failed",
          reason: shortError(error),
        };
      }
    }
    await saveReceipt(db, id, finalReceipt); // Persist the billable usage BEFORE attempting article writes.
    if (draft) {
      await saveDraft(db, { id, editorId: editor.id, draft, sources });
      revalidatePath(`/admin/calibration/${id}`);
      revalidatePath("/admin/inbox");
    } else {
      await failStage(
        db,
        id,
        "writing",
        finalReceipt.reason || "Writing failed",
      );
    }
  } catch (error) {
    const reason = shortError(error);
    console.error("Calibration writing failed", reason);
    await failStage(db, id, "writing", reason);
  }
  revalidatePath(`/admin/calibration/${id}`);
  const savedArticle = await existingDraft(id);
  redirect(
    savedArticle
      ? `/admin/calibration/${id}?message=draft_saved`
      : `/admin/calibration/${id}`,
  );
}

/** Recover an already-paid, completed JSON output if the article DB write failed. No API call. */
export async function recoverSavedWriting(form: FormData) {
  const editor = await requireEditorForAction();
  const id = String(form.get("id") || "").trim();
  if (!/^[a-zA-Z0-9-]{20,64}$/.test(id)) throw new Error("Invalid request ID");
  const db = await getCalibrationDb();
  if (await existingDraft(id))
    redirect(`/admin/calibration/${id}?message=draft_exists`);
  const calibration = await getCalibration(db, id);
  if (!calibration || calibration.research_status !== "completed")
    throw new Error("Research checkpoint unavailable");
  const saved = await db
    .prepare(
      "SELECT raw_text FROM ai_calibration_calls WHERE request_id = ? AND stage = 'writing' AND status = 'completed' ORDER BY created_at DESC, rowid DESC LIMIT 1",
    )
    .bind(id)
    .first<{ raw_text: string | null }>();
  if (!saved?.raw_text)
    throw new Error("No completed writing output exists for recovery");
  const sources = JSON.parse(calibration.sources_json) as EvidenceSource[];
  const draft = parseDraft(saved.raw_text, sources);
  const lock = await db
    .prepare(
      "UPDATE ai_calibrations SET writing_status = 'running' WHERE request_id = ? AND writing_status IN ('failed','none')",
    )
    .bind(id)
    .run();
  if (lock.meta.changes !== 1)
    redirect(`/admin/calibration/${id}?message=already_started`);
  try {
    await saveDraft(db, { id, editorId: editor.id, draft, sources });
  } catch (error) {
    await failStage(db, id, "writing", shortError(error));
    throw error;
  }
  revalidatePath(`/admin/calibration/${id}`);
  revalidatePath("/admin/inbox");
  redirect(`/admin/calibration/${id}?message=draft_saved`);
}
