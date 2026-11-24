import {
  addNewsSource,
  checkNewsFeeds,
  toggleNewsSource,
  updateNewsSourceInterval,
} from "@/app/admin/discovery-actions";
import { AdminPendingButton } from "@/components/admin-pending-button";
import { getDb } from "@/db/client";
import { newsSources, scrapeRuns } from "@/db/schema";
import { desc } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";
const field = "border-2 border-ink bg-white p-3 text-sm";
export default async function SourcesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const db = await getDb();
  const [sources, runs, query] = await Promise.all([
    db.select().from(newsSources).orderBy(newsSources.name),
    db.select().from(scrapeRuns).orderBy(desc(scrapeRuns.startedAt)).limit(8),
    searchParams,
  ]);
  return (
    <div className='grid gap-7 lg:grid-cols-[minmax(0,1fr)_340px]'>
      <section>
        <p className='text-xs font-black tracking-widest uppercase'>
          News discovery
        </p>
        <h2 className='font-display text-4xl font-black uppercase'>
          RSS sources
        </h2>
        <p className='mt-2 text-sm'>
          Collect headlines and links as <strong>story ideas only</strong>. No
          automatic article creation or publishing.
        </p>
        {query.checked !== undefined && (
          <p className='mt-4 border-2 border-ink bg-lilac p-3 text-sm font-bold'>
            Checked {query.checked} feeds; {query.found} new ideas;{" "}
            {query.errors} errors. See recent checks below.
          </p>
        )}
        <form action={checkNewsFeeds} className='my-5'>
          <AdminPendingButton
            idle='Check enabled feeds now'
            busy='Checking feeds…'
          />
        </form>
        <div className='space-y-3'>
          {sources.map((source) => (
            <div
              key={source.id}
              className='border-[3px] border-ink bg-card p-4'
            >
              <div className='flex flex-wrap justify-between gap-3'>
                <div>
                  <h3 className='text-lg font-black'>{source.name}</h3>
                  <p className='break-all text-xs'>{source.feedUrl}</p>
                  <p className='mt-1 text-xs'>
                    Every {source.pollIntervalMinutes} min ·{" "}
                    {source.isEnabled ? "enabled" : "paused"} · Last checked:{" "}
                    {source.lastFetchedAt || "Never"}
                  </p>
                </div>
                <form action={toggleNewsSource}>
                  <input type='hidden' name='id' value={source.id} />
                  <button className='border-2 border-ink bg-sun px-3 py-2 text-xs font-black'>
                    {source.isEnabled ? "Pause source" : "Enable source"}
                  </button>
                </form>
              </div>
              <form
                action={updateNewsSourceInterval}
                className='mt-3 flex flex-wrap items-center gap-2 border-t border-ink/20 pt-3 text-xs font-bold'
              >
                <input type='hidden' name='id' value={source.id} />
                Check every
                <input
                  type='number'
                  name='pollIntervalMinutes'
                  min='15'
                  max='10080'
                  defaultValue={source.pollIntervalMinutes}
                  className='w-24 border border-ink bg-white p-2'
                />{" "}
                minutes
                <button className='border-2 border-ink bg-white px-3 py-2'>
                  Save interval
                </button>
              </form>
            </div>
          ))}
          {sources.length === 0 && (
            <p className='border-2 border-dashed border-ink p-5 text-sm'>
              No feeds yet. Add an HTTPS RSS or Atom feed to begin.
            </p>
          )}
        </div>
        <Link
          href='/admin/ideas'
          className='mt-5 inline-block text-sm font-black underline'
        >
          Open story ideas inbox
        </Link>
      </section>
      <aside className='space-y-5'>
        <form
          action={addNewsSource}
          className='grid gap-3 border-[3px] border-ink bg-hero p-5 shadow-[4px_4px_0_#1b1818]'
        >
          <h3 className='font-display text-3xl font-black uppercase'>
            Add feed
          </h3>
          <label className='grid gap-1 text-sm font-black'>
            Name
            <input className={field} name='name' required maxLength={120} />
          </label>
          <label className='grid gap-1 text-sm font-black'>
            RSS/Atom URL (HTTPS)
            <input
              className={field}
              type='url'
              name='feedUrl'
              required
              placeholder='https://example.org/feed.xml'
            />
          </label>
          <label className='grid gap-1 text-sm font-black'>
            Check every (minutes)
            <input
              className={field}
              name='pollIntervalMinutes'
              type='number'
              min='15'
              max='10080'
              defaultValue='60'
            />
          </label>
          <AdminPendingButton idle='Add source' busy='Saving…' />
          <p className='text-xs'>
            Use authorized feeds and comply with publisher terms. Collection
            creates links and idea summaries, not copied articles.
          </p>
        </form>
        <div className='border-[3px] border-ink bg-card p-5'>
          <h3 className='font-display text-2xl font-black uppercase'>
            Recent checks
          </h3>
          <ul className='mt-3 space-y-3 text-xs'>
            {runs.map((run) => (
              <li key={run.id} className='border-b border-ink/20 pb-2'>
                <b>{run.status}</b> · {run.startedAt}
                <p>
                  {run.discoveredCount} new ideas{" "}
                  {run.errorMessage ? `· ${run.errorMessage}` : ""}
                </p>
              </li>
            ))}
            {!runs.length && <li>No checks have run yet.</li>}
          </ul>
        </div>
      </aside>
    </div>
  );
}
