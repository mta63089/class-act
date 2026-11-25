import {
  approveDraft,
  publishApproved,
  setQuoteVerification,
} from "@/app/admin/publishing-actions";
import { AdminPendingButton } from "@/components/admin-pending-button";
import { ArticleEditor } from "@/components/article-editor";
import { getDb } from "@/db/client";
import {
  articleQuotes,
  articles,
  articleSources,
  articleVersions,
  editorialEvents,
} from "@/db/schema";
import { articleWordCount, unfinishedImageIdeas } from "@/lib/article-blocks";
import {
  calibrationHistory,
  getCalibrationDb,
  type CalibrationCallRow,
} from "@/lib/calibration-db";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
function sourceNumber(notes: string | null) {
  return Number(/^Source #(\d+):/.exec(notes || "")?.[1] || 999);
}
export default async function DraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await getDb();
  const [article] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);
  if (!article) notFound();
  const [versions, sources, quotes, events] = await Promise.all([
    db
      .select()
      .from(articleVersions)
      .where(eq(articleVersions.articleId, id))
      .orderBy(articleVersions.version),
    db.select().from(articleSources).where(eq(articleSources.articleId, id)),
    db.select().from(articleQuotes).where(eq(articleQuotes.articleId, id)),
    db.select().from(editorialEvents).where(eq(editorialEvents.articleId, id)),
  ]);
  const orderedSources = sources.sort(
    (a, b) => sourceNumber(a.notes) - sourceNumber(b.notes),
  );
  const reference = orderedSources.map((s) => ({ title: s.title, url: s.url }));
  const quoteSource = new Map(orderedSources.map((s, i) => [s.id, i + 1]));
  const readOnly = ["published", "archived", "scheduled"].includes(
    article.status,
  );
  let usage: CalibrationCallRow[] = [];
  if (article.generationRequestId) {
    try {
      usage = await calibrationHistory(
        await getCalibrationDb(),
        article.generationRequestId,
      );
    } catch (error) {
      console.warn("Article usage receipts unavailable", error);
    }
  }
  const rewriteCosts = events
    .filter((e) => e.event === "block_rewrite_request")
    .map((e) => e.details?.estimatedUsd)
    .filter((x): x is number => typeof x === "number");
  const known =
    usage.reduce((sum, x) => sum + (x.estimated_usd ?? 0), 0) +
    rewriteCosts.reduce((sum, x) => sum + x, 0);
  const missing = usage.some((x) => x.estimated_usd === null);
  const wordCount = articleWordCount(article.body);
  const unfinished = unfinishedImageIdeas(article.body);
  return (
    <div className='space-y-8'>
      <header className='flex flex-wrap items-end justify-between gap-4 border-b-[3px] border-ink pb-5'>
        <div>
          <Link href='/admin/inbox' className='text-sm font-black underline'>
            Back to review inbox
          </Link>
          <p className='mt-3 text-xs font-black uppercase tracking-widest'>
            {article.status.replaceAll("_", " ")} · version{" "}
            {article.currentVersion}
          </p>
          <h2 className='font-display text-4xl font-black uppercase'>
            Edit & review story
          </h2>
          <p className='mt-1 text-sm'>
            This is a live-style preview. Changes are saved as a new version
            before approval.
          </p>
        </div>
        <div className='border-2 border-ink bg-lilac px-4 py-3 text-right text-xs'>
          <p className='font-black uppercase'>
            AI generation and rewrite usage
          </p>
          <p className='mt-1 font-display text-3xl font-black'>
            {usage.length || rewriteCosts.length
              ? `$${known.toFixed(4)}`
              : "Not recorded"}
          </p>
          <p>
            {missing
              ? "Partial estimate; some API usage unknown"
              : "Estimated USD · recorded attempts"}
          </p>
          {usage.map((call) => (
            <p key={call.id} className='mt-1'>
              {call.stage}: {call.model} · {call.input_tokens ?? "?"} in /{" "}
              {call.output_tokens ?? "?"} out ·{" "}
              {call.estimated_usd === null
                ? "unknown"
                : `$${call.estimated_usd.toFixed(4)}`}
            </p>
          ))}
          {rewriteCosts.length > 0 && (
            <p className='mt-1'>
              Block rewrites: {rewriteCosts.length} logged calls
            </p>
          )}
        </div>
      </header>
      <ArticleEditor
        key={article.currentVersion}
        articleId={article.id}
        version={article.currentVersion}
        title={article.title}
        dek={article.dek}
        section={article.section}
        initialBlocks={article.body}
        sources={reference}
        coverImage={
          article.image
            ? /^https:\/\//.test(article.image)
              ? article.image
              : article.image.startsWith("/assets/")
                ? article.image
                : `/assets/${article.image}.webp`
            : `/assets/${({ Politics: "hero", Labor: "labor", Economy: "economy", Culture: "culture" } as Record<string, string>)[article.section] || "hero"}.webp`
        }
        coverAlt={article.imageAlt || "Editorial illustration"}
        readOnly={readOnly}
      />
      <div className='grid gap-6 lg:grid-cols-[1fr_1fr]'>
        <section className='border-[3px] border-ink bg-card p-6 shadow-[4px_4px_0_#1b1818]'>
          <h3 className='font-display text-3xl font-black uppercase'>
            Editorial approval
          </h3>
          <p className='mt-2 text-sm'>
            Approval applies to the most recently <strong>saved</strong>{" "}
            version. If you've made changes in the preview, save them first.
          </p>
          <div className='mt-4 space-y-2 text-sm'>
            <p>
              {wordCount.toLocaleString()} words · {reference.length} sources ·{" "}
              {unfinished} image briefs
            </p>
            {unfinished > 0 && (
              <p className='font-bold text-pop-red'>
                Resolve all image briefs or remove them before approval.
              </p>
            )}
            <p>
              {quotes.every((q) => q.verificationStatus === "verified")
                ? "All recorded quote candidates are verified."
                : "Unverified or rejected quote candidates block approval."}
            </p>
          </div>
          {article.status === "approved" ? (
            <form action={publishApproved} className='mt-5'>
              <input type='hidden' name='id' value={id} />
              <AdminPendingButton
                idle='Publish approved article'
                busy='Publishing…'
              />
            </form>
          ) : ["draft", "in_review", "changes_requested"].includes(
              article.status,
            ) ? (
            <form action={approveDraft} className='mt-5'>
              <input type='hidden' name='id' value={id} />
              <AdminPendingButton
                idle='Approve saved version'
                busy='Approving…'
              />
            </form>
          ) : (
            <p className='mt-4 text-sm'>Article is {article.status}.</p>
          )}
        </section>
        <section className='border-[3px] border-ink bg-card p-6 shadow-[4px_4px_0_#1b1818]'>
          <h3 className='font-display text-3xl font-black uppercase'>
            Quotation review
          </h3>
          {quotes.length === 0 ? (
            <p className='mt-3 text-sm'>
              No external direct quotations recorded.
            </p>
          ) : (
            <div className='mt-4 space-y-4'>
              {quotes.map((quote) => (
                <div
                  key={quote.id}
                  className='border-t-2 border-ink/25 pt-4 text-sm'
                >
                  <strong>
                    {quote.speaker} · {quote.verificationStatus}
                  </strong>
                  <blockquote className='my-2 italic'>
                    “{quote.exactText}”
                  </blockquote>
                  <p className='text-xs'>{quote.contextNotes}</p>
                  <a
                    href={quote.originalUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-xs font-bold underline'
                  >
                    Verify original source [
                    {quoteSource.get(quote.sourceId || "") || "?"}]
                  </a>
                  {!readOnly && (
                    <form
                      action={setQuoteVerification}
                      className='mt-2 flex flex-wrap gap-2'
                    >
                      <input type='hidden' name='id' value={id} />
                      <input type='hidden' name='quoteId' value={quote.id} />
                      <button
                        name='verificationStatus'
                        value='verified'
                        className='border border-ink bg-sun px-3 py-1 text-xs font-bold'
                      >
                        Verified
                      </button>
                      <button
                        name='verificationStatus'
                        value='rejected'
                        className='border border-ink bg-white px-3 py-1 text-xs font-bold'
                      >
                        Reject
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <section className='border-[3px] border-ink bg-card p-5'>
        <h3 className='font-display text-3xl font-black uppercase'>
          Saved versions ({versions.length})
        </h3>
        <div className='mt-4 flex flex-wrap gap-3'>
          {versions.map((v) => (
            <span key={v.id} className='border border-ink/30 px-3 py-2 text-xs'>
              <strong>v{v.version}</strong> · {v.origin}
              <span className='block text-ink/65'>{v.changeSummary}</span>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
