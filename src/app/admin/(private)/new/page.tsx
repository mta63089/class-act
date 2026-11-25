import { queueManualGeneration } from "@/app/admin/actions";
import { generateFromBrief } from "@/app/admin/ai-actions";
import { AdminPendingButton } from "@/components/admin-pending-button";
import { editorialMode } from "@/lib/ai-editorial";

export default function RequestArticlePage() {
  const live = editorialMode() === "openai";
  const field = "border-2 border-ink bg-white p-3 font-normal";
  return (
    <section className="max-w-3xl">
      <p className="text-xs font-black uppercase tracking-widest">Editorial brief</p>
      <h2 className="font-display text-4xl font-black uppercase">Request an article</h2>
      <p className="mt-2 text-sm">
        {live ? "Research and write a sourced draft with one click. Completed research is saved automatically for retries." : "Create a free placeholder draft to test the CMS, or save a brief for later."}
      </p>
      <form action={generateFromBrief} className="mt-6 grid gap-4 border-[3px] border-ink bg-card p-6 shadow-[4px_4px_0_#1b1818]">
        <label className="grid gap-1 text-sm font-black">Article topic
          <textarea name="topic" rows={4} maxLength={3000} required className={field} placeholder="A story about…" />
        </label>
        <label className="grid gap-1 text-sm font-black">Framing / editorial angle
          <textarea name="framing" rows={3} maxLength={3000} className={field} placeholder="Explore this argument critically…" />
        </label>
        <label className="grid gap-1 text-sm font-black">Extra instructions
          <textarea name="instructions" rows={3} maxLength={5000} className={field} placeholder="Find original statements and verify the timeline…" />
        </label>
        <div className="border-l-4 border-pop-red bg-hero p-3 text-xs font-bold">
          {live ? "LIVE MODE: Generate calls OpenAI for research and writing. API usage is billed; articles still require your approval before publication." : "DEMO MODE: Generates placeholder text without AI API charges."}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AdminPendingButton
            idle={live ? "Research & generate article" : "Generate demo draft"}
            busy={live ? "Generating article…" : "Creating draft…"}
            generationOverlay
          />
          <button type="submit" formAction={queueManualGeneration} className="border-2 border-ink bg-white px-5 py-3 text-sm font-black">Save brief for later</button>
        </div>
      </form>
    </section>
  );
}
