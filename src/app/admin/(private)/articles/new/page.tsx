import { createManualArticle } from "@/app/admin/actions";

export default function WriteArticlePage() {
  return (
    <section className='max-w-4xl'>
      <p className='text-xs font-black uppercase tracking-widest'>
        Manual writing
      </p>
      <h2 className='font-display text-4xl font-black uppercase'>New draft</h2>
      <p className='mt-2 text-sm'>
        This creates a private article in D1. It does not publish anything.
        Separate paragraphs with a blank line.
      </p>
      <form
        action={createManualArticle}
        className='mt-6 grid gap-4 border-[3px] border-ink bg-card p-6 shadow-[4px_4px_0_#1b1818]'
      >
        <label className='grid gap-1 text-sm font-black'>
          Headline
          <input
            name='title'
            required
            maxLength={200}
            className='border-2 border-ink bg-white p-3 font-normal'
          />
        </label>
        <label className='grid gap-1 text-sm font-black'>
          Description / deck
          <textarea
            name='dek'
            rows={2}
            maxLength={600}
            required
            className='border-2 border-ink bg-white p-3 font-normal'
          />
        </label>
        <label className='grid gap-1 text-sm font-black'>
          Section
          <select
            name='section'
            className='border-2 border-ink bg-white p-3 font-normal'
          >
            {["Politics", "Labor", "Economy", "Culture"].map((section) => (
              <option key={section}>{section}</option>
            ))}
          </select>
        </label>
        <label className='grid gap-1 text-sm font-black'>
          Body
          <textarea
            name='body'
            rows={15}
            required
            maxLength={150000}
            className='border-2 border-ink bg-white p-3 font-normal leading-relaxed'
          />
        </label>
        <button className='justify-self-start border-2 border-ink bg-sun px-5 py-3 text-sm font-black shadow-[3px_3px_0_#1b1818]'>
          Save private draft
        </button>
      </form>
    </section>
  );
}
