import { listGeneratedJobs, listReviewInbox } from "@/db/queries";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const [articles, jobs] = await Promise.all([
    listReviewInbox(),
    listGeneratedJobs(),
  ]);
  return (
    <div className='grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]'>
      <section>
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
            href='/admin/articles/new'
            className='border-2 border-ink bg-sun px-4 py-2 text-sm font-black no-underline shadow-[3px_3px_0_#1b1818]'
          >
            Write an article
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
              New drafts will appear here. You can create a manual draft now;
              the AI generator is not connected yet.
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
          Requests are saved to D1, but automatic research and writing are not
          enabled in this phase.
        </p>
        <ul className='mt-5 space-y-4'>
          {jobs.slice(0, 8).map((job) => (
            <li key={job.id} className='border-t-2 border-ink pt-3'>
              <span className='text-xs font-extrabold uppercase'>
                {job.status}
              </span>
              <p className='mt-1 text-sm font-bold'>{job.topicPrompt}</p>
              {job.requestedFraming && (
                <p className='mt-1 text-xs'>Angle: {job.requestedFraming}</p>
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
