import type { D1Database } from "@cloudflare/workers-types";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import "server-only";
import type { StageReceipt } from "./calibration-openai";

export type CalibrationRow = {
  request_id: string;
  research_status: "none" | "running" | "completed" | "failed";
  research_notes: string | null;
  sources_json: string;
  writing_status: "none" | "running" | "completed" | "failed";
  article_id: string | null;
  created_at: string;
  updated_at: string;
};
export type CalibrationCallRow = {
  id: string;
  request_id: string;
  stage: "research" | "writing";
  model: string;
  status: "completed" | "incomplete" | "failed";
  response_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  reasoning_tokens: number | null;
  cached_input_tokens: number | null;
  web_calls: number;
  estimated_usd: number | null;
  reason: string | null;
  raw_text: string | null;
  duration_ms: number;
  created_at: string;
};

export async function getCalibrationDb(): Promise<D1Database> {
  const { env } = await getCloudflareContext({ async: true });
  const binding = (env as unknown as { DB?: D1Database }).DB;
  if (!binding) throw new Error("Missing D1 DB binding");
  return binding;
}
export async function getCalibration(
  db: D1Database,
  requestId: string,
): Promise<CalibrationRow | null> {
  return db
    .prepare("SELECT * FROM ai_calibrations WHERE request_id = ?")
    .bind(requestId)
    .first<CalibrationRow>();
}
export async function calibrationHistory(
  db: D1Database,
  requestId: string,
): Promise<CalibrationCallRow[]> {
  const result = await db
    .prepare(
      "SELECT * FROM ai_calibration_calls WHERE request_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 30",
    )
    .bind(requestId)
    .all<CalibrationCallRow>();
  return result.results;
}
export async function saveReceipt(
  db: D1Database,
  requestId: string,
  receipt: StageReceipt,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO ai_calibration_calls
    (id,request_id,stage,model,status,response_id,input_tokens,output_tokens,reasoning_tokens,cached_input_tokens,web_calls,estimated_usd,reason,raw_text,duration_ms)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      crypto.randomUUID(),
      requestId,
      receipt.stage,
      receipt.model,
      receipt.status,
      receipt.responseId,
      receipt.inputTokens,
      receipt.outputTokens,
      receipt.reasoningTokens,
      receipt.cachedInputTokens,
      receipt.webCalls,
      receipt.estimatedUsd,
      receipt.reason,
      receipt.rawText,
      receipt.durationMs,
    )
    .run();
}
