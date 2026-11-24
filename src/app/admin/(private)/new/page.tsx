import { queueManualGeneration } from "@/app/admin/actions";
import { generateFromBrief } from "@/app/admin/ai-actions";
import { AdminPendingButton } from "@/components/admin-pending-button";
import { editorialMode } from "@/lib/ai-editorial";

export default function RequestArticlePage() {
  const isMock = editorialMode() === "mock";
  const field = "border-2 border-ink bg-white p-3 font-normal";
  return (
    <section className='max-w-3xl'>
      <p className='text-xs font-black uppercase tracking-widest'>
        Editorial brief
      </p>
      <h2 className='font-display text-4xl font-black uppercase'>
        Request an article
      </h2>
      <p className='mt-2 text-sm'>
        Enter a topic and framing to test the entire CMS workflow. In demo mode,
        a structured placeholder article is created instantly without any API
        calls, real claims, or fabricated quotations.
      </p>
      <form
        action={generateFromBrief}
        className='mt-6 grid gap-4 border-[3px] border-ink bg-card p-6 shadow-[4px_4px_0_#1b1818]'
      >
        <label className='grid gap-1 text-sm font-black'>
          Article topic
          <textarea
            name='topic'
            rows={4}
            maxLength={3000}
            required
            placeholder='A story about the reactionary response to GTA 6…'
            className={field}
          />
        </label>
        <label className='grid gap-1 text-sm font-black'>
          Framing / editorial angle
          <textarea
            name='framing'
            rows={3}
            maxLength={3000}
            placeholder='Critique recurring culture-war outrage around entertainment releases; distinguish public statements from speculation.'
            className={field}
          />
        </label>
        <label className='grid gap-1 text-sm font-black'>
          Extra instructions
          <textarea
            name='instructions'
            rows={3}
            maxLength={5000}
            placeholder='Look for direct statements by identifiable commentators; identify the date and source of each quote.'
            className={field}
          />
        </label>
        <div className='border-l-4 border-pop-red bg-hero p-3 text-xs'>
          {isMock ? (
            <>
              <strong>DEMO MODE:</strong> Generated text is clearly marked as
              placeholder content. No tokens or live research will be used.
            </>
          ) : (
            <>
              <strong>LIVE MODE:</strong> Research links and quotations require
              editorial verification. OpenAI API usage is billed separately.
            </>
          )}
        </div>
        <div className='flex flex-wrap items-center gap-4'>
          <AdminPendingButton
            idle={isMock ? "Generate demo draft" : "Research & generate draft"}
            busy='Creating draft…'
          />
          <button
            type='submit'
            formAction={queueManualGeneration}
            className='border-2 border-ink bg-white px-5 py-3 text-sm font-black hover:bg-lilac'
          >
            Save brief for later
          </button>
        </div>
      </form>
    </section>
  );
}
