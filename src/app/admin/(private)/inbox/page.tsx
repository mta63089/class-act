import { generateQueuedArticle } from "@/app/admin/ai-actions";
import { AdminPendingButton } from "@/components/admin-pending-button";
import { listGeneratedJobs, listReviewInbox } from "@/db/queries";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ generation?: string }>;
}) {
  const [articles, jobs, query] = await Promise.all([
    listReviewInbox(),
    listGeneratedJobs(),
    searchParams,
  ]);
  return (
    <div className='grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]'>
      <section>
        {query.generation === "failed" && (
          <p
            role='alert'
            className='mb-5 border-l-4 border-pop-red bg-card p-4 text-sm font-bold'
          >
            Article generation did not complete. Check the failed request in the
            queue for details.
          </p>
        )}
        <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
          <div>
            <p className='text-xs font-black tracking-widest uppercase'>
              Human review required
            </p>
            <h2 className='font-display text-4xl font-black uppercase'>
              Draft inbox{" "}
              <span className='text-pop-red'>({articles.length})</span>
            </h2>
          </div>
          <Link
            href='/admin/new'
            className='border-2 border-ink bg-sun px-4 py-2 text-sm font-black no-underline shadow-[3px_3px_0_#1b1818]'
          >
            Generate an article
          </Link>
        </div>
        {articles.length ? (
          <div className='divide-y-2 divide-ink border-[3px] border-ink bg-card'>
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`/admin/articles/${article.id}`}
                className='block p-5 no-underline hover:bg-lilac/50'
              >
                <div className='mb-2 flex flex-wrap gap-2 text-xs font-black uppercase tracking-wide'>
                  <span className='bg-lilac px-2 py-1'>
                    {article.status.replaceAll("_", " ")}
                  </span>
                  <span>{article.section}</span>
                  <span>
                    {article.createdWithAi ? "AI draft" : "Manual draft"}
                  </span>
                </div>
                <h3 className='font-display text-2xl font-extrabold leading-tight'>
                  {article.title}
                </h3>
                <p className='mt-1 text-sm'>{article.dek}</p>
                <p className='mt-2 text-xs font-semibold text-ink/70'>
                  Revision {article.currentVersion} · {article.updatedAt}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className='border-[3px] border-dashed border-ink bg-card p-8'>
            <h3 className='font-display text-3xl font-black uppercase'>
              Nothing waiting for review
            </h3>
            <p className='mt-2 text-sm'>
              Generate an AI draft or write an article manually to add it to the
              inbox.
            </p>
          </div>
        )}
      </section>
      <aside className='self-start border-[3px] border-ink bg-lilac p-5 shadow-[4px_4px_0_#1b1818]'>
        <p className='text-xs font-black uppercase tracking-widest'>
          Generator queue
        </p>
        <h2 className='mt-1 font-display text-3xl font-black uppercase'>
          Requests ({jobs.length})
        </h2>
        <p className='mt-2 text-sm'>
          Queued briefs can be generated on demand. Only you can review drafts.
        </p>
        <ul className='mt-5 space-y-5'>
          {jobs.slice(0, 12).map((job) => (
            <li key={job.id} className='border-t-2 border-ink pt-3'>
              <span className='text-xs font-extrabold uppercase'>
                {job.status}
              </span>
              <p className='mt-1 text-sm font-bold'>{job.topicPrompt}</p>
              {job.requestedFraming && (
                <p className='mt-1 text-xs'>Angle: {job.requestedFraming}</p>
              )}
              {job.status === "failed" && job.errorMessage && (
                <p className='mt-2 break-words text-xs font-bold text-red-800'>
                  {job.errorMessage}
                </p>
              )}
              {(job.status === "queued" ||
                (job.status === "failed" &&
                  !job.errorMessage?.includes("already has a draft"))) && (
                <form action={generateQueuedArticle} className='mt-3'>
                  <input type='hidden' name='id' value={job.id} />
                  <AdminPendingButton
                    idle={
                      job.status === "failed"
                        ? "Retry generation"
                        : "Generate now"
                    }
                    busy='Generating…'
                    className='px-3 py-2 text-xs'
                  />
                </form>
              )}
              {job.status === "running" && (
                <p className='mt-2 text-xs'>
                  Generation started. Refresh to check status.
                </p>
              )}
            </li>
          ))}
          {!jobs.length && <li className='text-sm'>No requests yet.</li>}
        </ul>
        <Link
          href='/admin/new'
          className='mt-6 inline-block text-sm font-black underline'
        >
          Submit a story brief
        </Link>
      </aside>
    </div>
  );
}
