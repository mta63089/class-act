import { calibrateResearch, calibrateWriting, recoverSavedWriting } from "@/app/admin/calibration-actions";
import { CalibrationSubmitButton } from "@/components/calibration-submit-button";
import { getDb } from "@/db/client";
import { articles, generationRequests } from "@/db/schema";
import { calibrationHistory, getCalibration, getCalibrationDb } from "@/lib/calibration-db";
import { calibrationCaps, calibrationModels, paidCallsEnabled, type EvidenceSource } from "@/lib/calibration-openai";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const box = "border-[3px] border-ink bg-card p-5 shadow-[3px_3px_0_#1b1818]";
export default async function CalibrationDetail({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const drizzleDb = await getDb();
  const [brief] = await drizzleDb.select().from(generationRequests).where(eq(generationRequests.id, id)).limit(1);
  if (!brief) notFound();
  const db = await getCalibrationDb();
  const [record, calls, linked] = await Promise.all([
    getCalibration(db, id),
    calibrationHistory(db, id),
    drizzleDb.select({ id: articles.id, title: articles.title }).from(articles)
      .where(eq(articles.generationRequestId, id)).limit(1),
  ]);
  let sources: EvidenceSource[] = [];
  try { sources = JSON.parse(record?.sources_json || "[]") as EvidenceSource[]; }
  catch { sources = []; }
  const models = calibrationModels();
  const caps = calibrationCaps();
  const enabled = paidCallsEnabled();
  const article = linked[0];
  const knownTotal = calls.reduce((sum, call) => sum + (call.estimated_usd || 0), 0);
  const unknown = calls.some(call => call.estimated_usd === null);
  return <div className="max-w-5xl space-y-7">
    <Link href="/admin/calibration" className="text-sm font-black underline">Back to calibration</Link>
    <div>
      <p className="text-xs font-black uppercase tracking-widest">Single-brief calibration / two separate API calls</p>
      <h2 className="font-display text-4xl font-black uppercase">{brief.topicPrompt}</h2>
      {brief.requestedFraming && <p className="mt-3 text-sm"><strong>Requested angle:</strong> {brief.requestedFraming}</p>}
      {brief.additionalInstructions && <p className="mt-2 whitespace-pre-wrap text-sm"><strong>Instructions:</strong> {brief.additionalInstructions}</p>}
    </div>
    {query.message && <p role="status" className="border-l-4 border-sun bg-hero p-4 text-sm">{query.message === "draft_saved" ? "Draft saved to your private review inbox." : query.message === "draft_exists" ? "A draft is already linked to this brief; a duplicate was blocked." : "This stage was already started or completed; no extra call was made."}</p>}
    <div className="border-l-4 border-pop-red bg-hero p-5 text-sm">
      <strong>Paid API access: {enabled ? "ENABLED for this local environment" : "DISABLED"}.</strong>
      <p className="mt-2">Each button requires its own explicit checkbox. The maximum output tokens are a ceiling, not a cost guarantee. A failed or incomplete response may still be billed. No automatic retries or background paid calls.</p>
    </div>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className={box}>
        <p className="text-xs font-black uppercase tracking-widest">Stage 1 / source discovery and research</p>
        <h3 className="mt-2 font-display text-3xl font-black uppercase">Research</h3>
        <p className="mt-2 text-sm"><strong>Model:</strong> {models.research}</p>
        <p className="mt-1 text-sm"><strong>Max output:</strong> {caps.research.toLocaleString()} tokens · one web-search tool call</p>
        <p className="mt-2 text-sm"><strong>Status:</strong> {record?.research_status || "none"}</p>
        {record?.research_status === "completed" ? <p className="mt-4 text-sm font-bold">Saved in D1. Writing can reuse this research without another search call.</p> :
          record?.research_status === "running" ? <p className="mt-4 text-sm">Already running. Do not retry until this request has been investigated.</p> :
          <form action={calibrateResearch} className="mt-5 space-y-4">
            <input type="hidden" name="id" value={brief.id} />
            <label className="flex items-start gap-2 text-sm font-semibold">
              <input type="checkbox" name="authorize" value="yes" required className="mt-1 size-4 accent-ink" />
              I authorize one paid research request. I know an incomplete result may still be charged.
            </label>
            {enabled ? <CalibrationSubmitButton stage="research" /> : <p className="font-bold text-sm">Enable the two local environment switches when you deliberately choose a paid test.</p>}
          </form>}
      </section>
      <section className={box}>
        <p className="text-xs font-black uppercase tracking-widest">Stage 2 / reuse saved research</p>
        <h3 className="mt-2 font-display text-3xl font-black uppercase">Write article</h3>
        <p className="mt-2 text-sm"><strong>Model:</strong> {models.writing}</p>
        <p className="mt-1 text-sm"><strong>Max output:</strong> {caps.writing.toLocaleString()} tokens · no web search</p>
        <p className="mt-2 text-sm"><strong>Status:</strong> {record?.writing_status || "none"}</p>
        {article ? <Link href={`/admin/articles/${article.id}`} className="mt-5 inline-block border-2 border-ink bg-sun px-4 py-2 text-sm font-black no-underline">Open saved article draft</Link> :
          record?.writing_status === "running" ? <p className="mt-4 text-sm">Writing started. Check the stage log before doing anything else.</p> :
          record?.research_status !== "completed" ? <p className="mt-4 text-sm">Complete the research stage first. Writing won't run without saved source notes.</p> :
          <form action={calibrateWriting} className="mt-5 space-y-4">
            <input type="hidden" name="id" value={brief.id} />
            <label className="flex items-start gap-2 text-sm font-semibold">
              <input type="checkbox" name="authorize" value="yes" required className="mt-1 size-4 accent-ink" />
              I authorize one paid writing request using the saved research.
            </label>
            {enabled ? <CalibrationSubmitButton stage="writing" /> : <p className="font-bold text-sm">Live paid calls are disabled.</p>}
          </form>}
      </section>
    </div>
    {record?.research_notes && <section className={box}>
      <h3 className="font-display text-2xl font-black uppercase">Saved research notes {record.research_status !== "completed" ? "(incomplete / not approved for writing)" : ""}</h3>
      <p className="mt-2 text-xs font-bold">Research text is reusable; quotes and claims still require human verification.</p>
      <pre className="mt-4 max-h-[420px] overflow-auto whitespace-pre-wrap text-sm font-sans leading-relaxed">{record.research_notes}</pre>
      <h4 className="mt-6 text-sm font-black uppercase">Source URLs ({sources.length})</h4>
      <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
        {sources.map((s,i) => <li key={`${s.url}-${i}`}><a href={s.url} target="_blank" rel="noopener noreferrer" className="break-all font-semibold underline">{s.title}</a></li>)}
      </ol>
    </section>}
    {!article && calls.some(c => c.stage === "writing" && c.status === "completed" && c.raw_text) &&
      <form action={recoverSavedWriting} className="border-[3px] border-ink bg-lilac p-5">
        <input type="hidden" name="id" value={id} />
        <h3 className="font-display text-2xl font-black uppercase">Recover a saved writing response</h3>
        <p className="mt-2 text-sm">A completed writing response is stored but no article is linked. This will retry the local database save only, without calling OpenAI.</p>
        <button type="submit" className="mt-3 border-2 border-ink bg-sun px-4 py-2 text-sm font-black">Recover without API charges</button>
      </form>}
    <section className={box}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest">Measured usage / all attempts</p>
          <h3 className="font-display text-3xl font-black uppercase">Stage receipts ({calls.length})</h3>
        </div>
        <div className="text-right"><p className="text-xl font-black">${knownTotal.toFixed(4)} estimated</p><p className="text-xs">{unknown ? "At least one call has unknown cost" : "Model tokens + search-call estimate"}</p></div>
      </div>
      <div className="mt-5 space-y-4">
        {calls.map(call => <article key={call.id} className="border-t-2 border-ink/40 pt-4 text-sm">
          <p className="font-black uppercase">{call.stage} · {call.status} · {call.model}</p>
          <p className="mt-1">Input {call.input_tokens ?? "unknown"} · Output {call.output_tokens ?? "unknown"} · Reasoning {call.reasoning_tokens ?? "unknown"} · Searches {call.web_calls} · {call.estimated_usd === null ? "Cost unknown" : `$${call.estimated_usd.toFixed(4)} estimated`}</p>
          <p className="mt-1 text-xs">{call.duration_ms} ms · API response {call.response_id || "unknown"} · {call.created_at}</p>
          {call.reason && <p role="alert" className="mt-2 border-l-4 border-pop-red pl-3 text-sm font-semibold">{call.reason}</p>}
          {call.stage === "writing" && call.raw_text && !article && <details className="mt-3"><summary className="cursor-pointer font-bold underline">Inspect saved writing output</summary><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap text-xs">{call.raw_text}</pre></details>}
        </article>)}
        {!calls.length && <p className="text-sm">No paid calls have been attempted for this brief.</p>}
      </div>
      <p className="mt-5 border-t border-ink/20 pt-3 text-xs">Cost estimates use published standard token rates and an assumed $0.01 per search call; actual API billing may differ. Token usage includes invisible reasoning tokens. If a request timed out before receipt data arrived, the cost can be unknown.</p>
    </section>
  </div>;
}
