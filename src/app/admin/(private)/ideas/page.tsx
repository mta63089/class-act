import { addDemoIdeas, turnIdeaIntoBrief } from "@/app/admin/discovery-actions";
import { listDiscoveredIdeas } from "@/db/queries";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function IdeasPage() {
  const ideas = await listDiscoveredIdeas();
  return (
    <section>
      <p className='text-xs font-black uppercase tracking-widest'>
        Discovery pipeline
      </p>
      <h2 className='font-display text-4xl font-black uppercase'>
        Story ideas ({ideas.length})
      </h2>
      <p className='mt-2 max-w-2xl text-sm'>
        RSS sources and demo data can populate this inbox. Convert an idea into
        a brief, then generate a mock article for review.
      </p>
      <div className='mt-5 flex flex-wrap gap-3'>
        <form action={addDemoIdeas}>
          <button className='border-2 border-ink bg-sun px-4 py-2 text-sm font-black'>
            Add sample ideas
          </button>
        </form>
        <Link
          href='/admin/sources'
          className='border-2 border-ink bg-white px-4 py-2 text-sm font-black no-underline'
        >
          Manage RSS sources
        </Link>
      </div>
      <div className='mt-6 space-y-4'>
        {ideas.map((idea) => (
          <article
            key={idea.id}
            className='border-[3px] border-ink bg-card p-5 shadow-[3px_3px_0_#1b1818]'
          >
            <p className='text-xs font-bold uppercase'>
              {idea.section || "Uncategorized"}
            </p>
            <h3 className='mt-1 font-display text-2xl font-extrabold'>
              {idea.headline}
            </h3>
            <p className='mt-2 text-sm'>{idea.summary}</p>
            {idea.suggestedAngle && (
              <p className='mt-2 text-sm'>
                <strong>Suggested angle:</strong> {idea.suggestedAngle}
              </p>
            )}
            {idea.sourceUrl && (
              <a
                href={idea.sourceUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='mt-3 inline-block text-sm font-bold underline'
              >
                Original source
              </a>
            )}
            <form action={turnIdeaIntoBrief} className='mt-4'>
              <input name='id' value={idea.id} type='hidden' />
              <button className='border-2 border-ink bg-sun px-3 py-2 text-xs font-black'>
                Create article brief
              </button>
            </form>
          </article>
        ))}
        {!ideas.length && (
          <div className='border-[3px] border-dashed border-ink bg-card p-8'>
            <h3 className='font-display text-3xl font-bold uppercase'>
              No discovered ideas yet
            </h3>
            <p className='mt-2 text-sm'>
              For now, create your own brief from the manual request screen.
            </p>
            <Link
              href='/admin/new'
              className='mt-3 inline-block font-bold underline'
            >
              Create a story brief
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
