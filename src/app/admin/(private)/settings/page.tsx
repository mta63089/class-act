import { eq } from "drizzle-orm";
import { saveDiscoverySettings, saveEditorialProfile } from "@/app/admin/discovery-actions";
import { getDb } from "@/db/client";
import { automationSettings, editorialProfiles } from "@/db/schema";
import { AdminPendingButton } from "@/components/admin-pending-button";

export const dynamic = "force-dynamic";
const field = "w-full border-2 border-ink bg-white p-3 font-normal";
export default async function SettingsPage() {
  const db = await getDb();
  const [[schedule], [profile]] = await Promise.all([
    db.select().from(automationSettings).where(eq(automationSettings.name, "news-discovery")).limit(1),
    db.select().from(editorialProfiles).where(eq(editorialProfiles.isDefault, true)).limit(1),
  ]);
  return <div className="max-w-4xl space-y-7">
    <header><p className="text-xs font-black uppercase tracking-widest">Newsroom controls</p><h2 className="font-display text-4xl font-black uppercase">Editorial settings</h2>
      <p className="mt-2 text-sm">The review gate is mandatory. All drafts still require your approval.</p></header>
    <form action={saveEditorialProfile} className="grid gap-4 border-[3px] border-ink bg-card p-6 shadow-[4px_4px_0_#1b1818]">
      <h3 className="font-display text-3xl font-black uppercase">Writing style</h3>
      <label className="grid gap-1 text-sm font-black">Profile name<input className={field} name="name" defaultValue={profile?.name || "Default newsroom style"} /></label>
      <label className="grid gap-1 text-sm font-black">Editorial instructions<textarea className={field} name="writingInstructions" rows={8} required maxLength={8000}
        defaultValue={profile?.writingInstructions || "Original, clearly attributed reporting and opinion. Distinguish factual claims from interpretation. Prioritize verifiable evidence and context. Avoid invented quotations."} /></label>
      <p className="text-xs">Saved for future live generation. Demo generation records your framing but deliberately creates placeholder text.</p>
      <AdminPendingButton idle="Save writing style" busy="Saving…" />
    </form>
    <form action={saveDiscoverySettings} className="grid gap-4 border-[3px] border-ink bg-lilac p-6 shadow-[4px_4px_0_#1b1818]">
      <h3 className="font-display text-3xl font-black uppercase">News discovery schedule</h3>
      <label className="flex items-center gap-3 text-sm font-bold"><input type="checkbox" name="enabled" defaultChecked={schedule?.isEnabled || false} className="h-5 w-5" /> Enable scheduled feed discovery</label>
      <label className="grid gap-1 text-sm font-black">Max new ideas per run<input className={field} name="maxIdeasPerRun" type="number" min="1" max="100" defaultValue={schedule?.maxIdeasPerRun || 20} /></label>
      <p className="text-xs">Cloudflare Cron checks every 15 minutes after the separately configured scheduler Worker is deployed; per-source polling intervals determine which feeds are due. Changing the 15-minute cron itself requires a deployment. Local manual feed checks work without deploying.</p>
      <p className="text-xs font-bold">Publication always requires editorial approval. This setting cannot be disabled.</p>
      <AdminPendingButton idle="Save discovery settings" busy="Saving…" />
    </form>
  </div>;
}
