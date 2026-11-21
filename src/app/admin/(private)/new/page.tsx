import { queueManualGeneration } from "@/app/admin/actions";

export default function RequestArticlePage() {
  return (
    <section className='max-w-3xl'>
      <p className='text-xs font-black uppercase tracking-widest'>
        Editorial brief
      </p>
      <h2 className='font-display text-4xl font-black uppercase'>
        Request an article
      </h2>
      <p className='mt-2 text-sm'>
        Describe a topic, the framing, and any evidence you want researched. The
        brief will enter the queue.{" "}
        <strong>AI generation is not connected yet.</strong>
      </p>
      <form
        action={queueManualGeneration}
        className='mt-6 grid gap-4 border-[3px] border-ink bg-card p-6 shadow-[4px_4px_0_#1b1818]'
      >
        <label className='grid gap-1 text-sm font-black'>
          Article topic
          <textarea
            name='topic'
            rows={4}
            maxLength={3000}
            required
            placeholder='A story about…'
            className='border-2 border-ink bg-white p-3 font-normal'
          />
        </label>
        <label className='grid gap-1 text-sm font-black'>
          Framing / editorial angle
          <textarea
            name='framing'
            rows={3}
            maxLength={3000}
            placeholder='Examine the argument critically from a working-class perspective…'
            className='border-2 border-ink bg-white p-3 font-normal'
          />
        </label>
        <label className='grid gap-1 text-sm font-black'>
          Extra instructions
          <textarea
            name='instructions'
            rows={3}
            maxLength={5000}
            placeholder='Find primary-source quotes; verify dates; link original reporting…'
            className='border-2 border-ink bg-white p-3 font-normal'
          />
        </label>
        <p className='text-xs'>
          Quotes will require source verification and human approval before
          future publication.
        </p>
        <button className='justify-self-start border-2 border-ink bg-sun px-5 py-3 text-sm font-black shadow-[3px_3px_0_#1b1818]'>
          Save request to queue
        </button>
      </form>
    </section>
  );
}
