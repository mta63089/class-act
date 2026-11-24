import { saveManualRevision } from "@/app/admin/actions";
import { reviseWithAi } from "@/app/admin/ai-actions";
import {
  approveDraft,
  publishApproved,
  setQuoteVerification,
} from "@/app/admin/publishing-actions";
import { AdminPendingButton } from "@/components/admin-pending-button";
import { CitedText } from "@/components/cited-text";
import { getDb } from "@/db/client";
import {
  articleQuotes,
  articles,
  articleSources,
  articleVersions,
  reviewComments,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function sourceNumber(notes: string | null): number {
  const match = /^Source #(\d+):/.exec(notes || "");
  return match ? Number(match[1]) : 999;
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
  const [versions, storedSources, quotes, revisionRequests] = await Promise.all(
    [
      db
        .select()
        .from(articleVersions)
        .where(eq(articleVersions.articleId, id))
        .orderBy(articleVersions.version),
      db.select().from(articleSources).where(eq(articleSources.articleId, id)),
      db.select().from(articleQuotes).where(eq(articleQuotes.articleId, id)),
      db.select().from(reviewComments).where(eq(reviewComments.articleId, id)),
    ],
  );
  const sources = storedSources.sort(
    (a, b) => sourceNumber(a.notes) - sourceNumber(b.notes),
  );
  const references = sources.map((source) => ({
    title: source.title,
    url: source.url,
  }));
  const sourceIndex = new Map(
    sources.map((source, index) => [source.id, index + 1]),
  );
  const allQuotesVerified = quotes.every(
    (quote) => quote.verificationStatus === "verified",
  );
  const editable =
    !["published", "archived", "scheduled"].includes(article.status) &&
    article.body.every((block) => block.type === "paragraph");
  const body = article.body
    .map((block) => (block.type === "paragraph" ? block.text : ""))
    .filter(Boolean)
    .join("\n\n");

  return (
    <div className='grid gap-7 lg:grid-cols-[minmax(0,1fr)_360px]'>
      <section>
        <Link
          href='/admin/inbox'
          className='mb-3 inline-block text-sm font-black underline'
        >
          Back to review inbox
        </Link>
        <p className='text-xs font-black uppercase tracking-widest'>
          {article.status.replaceAll("_", " ")} · Version{" "}
          {article.currentVersion} ·{" "}
          {article.createdWithAi ? "AI assisted" : "Staff"}
        </p>
        <h2 className='font-display text-4xl font-black uppercase'>
          Review & edit draft
        </h2>
        <div className='mt-5 border-[3px] border-ink bg-hero p-6 shadow-[4px_4px_0_#1b1818]'>
          <p className='text-xs font-black tracking-widest uppercase'>
            Live draft preview — private
          </p>
          <h3 className='mt-3 font-display text-5xl font-black uppercase leading-[.95]'>
            {article.title}
          </h3>
          <p className='mt-3 border-b-2 border-ink pb-5 text-base font-semibold'>
            {article.dek}
          </p>
          <div className='mt-5 space-y-5 text-base leading-relaxed'>
            {article.body.map((block, i) =>
              block.type === "paragraph" ? (
                <p key={i}>
                  <CitedText text={block.text} sources={references} />
                </p>
              ) : block.type === "heading" ? (
                <h4 key={i} className='font-display text-2xl font-bold'>
                  {block.text}
                </h4>
              ) : block.type === "quote" ? (
                <blockquote
                  key={i}
                  className='border-l-4 border-ink pl-4 italic'
                >
                  {block.text} — {block.attribution}
                </blockquote>
              ) : (
                <ul key={i} className='list-disc pl-6'>
                  {block.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              ),
            )}
          </div>
        </div>
        {article.kind === "Demo Article" && (
          <div className='mt-5 border-[3px] border-pop-red bg-sun p-4 text-sm font-black'>
            DEMO / PLACEHOLDER ARTICLE — contains no researched reporting.
            Intended for testing the CMS only.
          </div>
        )}
        <div className='mt-5 flex flex-wrap items-center gap-3 border-[3px] border-ink bg-card p-4'>
          {article.status === "approved" ? (
            <>
              <p className='text-sm font-bold'>
                Approved version {article.approvedVersion}. Publish only when
                content has been reviewed.
              </p>
              <form action={publishApproved}>
                <input type='hidden' name='id' value={article.id} />
                <AdminPendingButton
                  idle='Publish approved article'
                  busy='Publishing…'
                />
              </form>
            </>
          ) : ["draft", "in_review", "changes_requested"].includes(
              article.status,
            ) ? (
            <>
              <p className='text-sm font-bold'>
                {allQuotesVerified
                  ? "Ready for your editorial approval."
                  : "Verify all quotes before approval."}
              </p>
              <form action={approveDraft}>
                <input type='hidden' name='id' value={article.id} />
                <AdminPendingButton
                  idle='Approve this revision'
                  busy='Approving…'
                />
              </form>
            </>
          ) : (
            <p className='text-sm font-bold'>
              Article status: {article.status}
            </p>
          )}
        </div>
        {editable ? (
          <>
            <form
              action={reviseWithAi}
              className='mt-7 grid gap-3 border-[3px] border-ink bg-lilac p-6 shadow-[4px_4px_0_#1b1818]'
            >
              <p className='text-xs font-black uppercase tracking-widest'>
                AI revision request
              </p>
              <h3 className='font-display text-3xl font-black uppercase'>
                Suggest changes
              </h3>
              <p className='text-sm'>
                Ask for changes to tone, structure, or emphasis. The revised
                draft becomes a new saved version. No automatic publishing.
              </p>
              <input type='hidden' name='id' value={article.id} />
              <textarea
                name='instruction'
                required
                maxLength={3000}
                rows={4}
                className='border-2 border-ink bg-white p-3 text-sm'
                placeholder='Make the introduction sharper, add context to the counterargument, and keep every source citation…'
              />
              <AdminPendingButton
                idle='Generate revised draft'
                busy='Revising article…'
                className='justify-self-start'
              />
            </form>
            <form
              action={saveManualRevision}
              className='mt-7 grid gap-4 border-[3px] border-ink bg-card p-6 shadow-[4px_4px_0_#1b1818]'
            >
              <h3 className='font-display text-3xl font-black uppercase'>
                Edit manually
              </h3>
              <input type='hidden' name='id' value={article.id} />
              <label className='grid gap-1 text-sm font-black'>
                Headline
                <input
                  name='title'
                  required
                  defaultValue={article.title}
                  maxLength={200}
                  className='border-2 border-ink bg-white p-3 font-normal'
                />
              </label>
              <label className='grid gap-1 text-sm font-black'>
                Description
                <textarea
                  name='dek'
                  required
                  rows={2}
                  maxLength={600}
                  defaultValue={article.dek}
                  className='border-2 border-ink bg-white p-3 font-normal'
                />
              </label>
              <label className='grid gap-1 text-sm font-black'>
                Body (blank lines separate paragraphs)
                <textarea
                  name='body'
                  required
                  rows={18}
                  maxLength={150000}
                  defaultValue={body}
                  className='border-2 border-ink bg-white p-3 font-normal leading-relaxed'
                />
              </label>
              <p className='text-xs'>
                Keep or update the [1], [2], etc. citation markers when editing.
                Saving creates another version.
              </p>
              <AdminPendingButton
                idle='Save manual revision'
                busy='Saving…'
                className='justify-self-start'
              />
            </form>
          </>
        ) : (
          <div className='mt-5 border-2 border-ink bg-lilac p-5 text-sm font-bold'>
            This article is published, scheduled, archived, or contains
            structured blocks. It is not editable in this draft editor.
          </div>
        )}
      </section>
      <aside className='self-start space-y-5'>
        <div className='border-[3px] border-ink bg-card p-5'>
          <p className='text-xs font-black uppercase tracking-widest'>
            Research sources ({sources.length})
          </p>
          {sources.length ? (
            <ol className='mt-3 space-y-3 text-sm'>
              {sources.map((source, index) => (
                <li key={source.id} className='wrap-break-word'>
                  <span className='font-bold'>[{index + 1}] </span>
                  <a
                    href={source.url}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='font-bold underline'
                  >
                    {source.title}
                  </a>
                  <span className='mt-1 block break-all text-[11px] text-ink/70'>
                    {source.url}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className='mt-2 text-sm'>No sources attached.</p>
          )}
          <p className='mt-4 border-t-2 border-ink pt-3 text-xs'>
            Source retrieval does not guarantee that a claim or quotation is
            accurate. Check the original before publishing.
          </p>
        </div>
        <div className='border-[3px] border-ink bg-card p-5'>
          <p className='text-xs font-black uppercase tracking-widest'>
            Quotation review ({quotes.length})
          </p>
          {quotes.length ? (
            <ul className='mt-4 space-y-4 text-sm'>
              {quotes.map((quote) => (
                <li key={quote.id} className='border-t border-ink/30 pt-3'>
                  <p className='font-bold'>
                    {quote.speaker} ·{" "}
                    <span className='text-pop-red'>
                      {quote.verificationStatus}
                    </span>
                  </p>
                  <blockquote className='mt-1 italic'>
                    “{quote.exactText}”
                  </blockquote>
                  <p className='mt-1 text-xs'>{quote.contextNotes}</p>
                  <a
                    href={quote.originalUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='mt-1 block text-xs font-bold underline'
                  >
                    Check source [{sourceIndex.get(quote.sourceId || "") ?? "?"}
                    ]
                  </a>
                  {!["published", "archived"].includes(article.status) && (
                    <form
                      action={setQuoteVerification}
                      className='mt-2 flex flex-wrap gap-2'
                    >
                      <input type='hidden' name='id' value={article.id} />
                      <input type='hidden' name='quoteId' value={quote.id} />
                      <button
                        name='verificationStatus'
                        value='verified'
                        className='border border-ink bg-sun px-2 py-1 text-xs font-bold'
                      >
                        I verified this quote
                      </button>
                      <button
                        name='verificationStatus'
                        value='rejected'
                        className='border border-ink bg-white px-2 py-1 text-xs font-bold'
                      >
                        Reject quotation
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className='mt-2 text-sm'>
              No direct quotation candidates recorded.
            </p>
          )}
          <p className='mt-4 text-xs font-semibold'>
            Verify exact wording and context in the original source before
            marking a quotation verified. Rejected quotations block publication.
          </p>
        </div>
        <div className='border-[3px] border-ink bg-card p-5'>
          <p className='text-xs font-black tracking-widest uppercase'>
            Revision history
          </p>
          <ol className='mt-3 space-y-3 text-sm'>
            {versions.map((version) => (
              <li key={version.id} className='border-b border-ink/20 pb-2'>
                <strong>v{version.version}</strong> · {version.origin} ·{" "}
                {version.createdAt}
                {version.changeSummary && (
                  <p className='mt-1 text-xs'>{version.changeSummary}</p>
                )}
              </li>
            ))}
          </ol>
          {revisionRequests.filter(
            (comment) => comment.type === "ai_revision_request",
          ).length > 0 && (
            <>
              <p className='mt-4 text-xs font-black uppercase'>
                Editor requests
              </p>
              <ul className='mt-2 space-y-2 text-sm'>
                {revisionRequests
                  .filter((comment) => comment.type === "ai_revision_request")
                  .map((comment) => (
                    <li key={comment.id} className='border-l-2 border-ink pl-3'>
                      v{comment.articleVersion}: {comment.message}
                    </li>
                  ))}
              </ul>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
