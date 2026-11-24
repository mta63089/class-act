import { getDb } from "@/db/client";
import { generationRequests } from "@/db/schema";
import { desc } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CalibrationIndex() {
  const db = await getDb();
  const requests = await db.select().from(generationRequests).orderBy(desc(generationRequests.createdAt)).limit(100);
  return <section className="space-y-5">
    <div>
      <p className="text-xs font-black uppercase tracking-widest">Cost-controlled experiments</p>
      <h2 className="font-display text-4xl font-black uppercase">AI Calibration Lab</h2>
      <p className="mt-3 max-w-3xl text-sm">Research and writing are separate, paid, explicitly authorized actions. Research is saved to D1 before writing. Ordinary generation remains in mock mode; no calls happen just by opening this page.</p>
    </div>
    <Link href="/admin/new" className="inline-block border-2 border-ink bg-sun px-4 py-3 text-sm font-bold no-underline">Create a story brief</Link>
    <div className="space-y-3">
      {requests.map(r => <Link href={`/admin/calibration/${r.id}`} key={r.id}
        className="block border-2 border-ink bg-card p-5 no-underline hover:bg-lilac/40">
        <span className="text-xs font-black uppercase">{r.status} · {r.origin}</span>
        <h3 className="mt-1 font-display text-2xl font-extrabold">{r.topicPrompt}</h3>
        {r.requestedFraming && <p className="mt-2 text-sm">{r.requestedFraming}</p>}
      </Link>)}
      {requests.length === 0 && <p className="border-2 border-dashed border-ink p-6">No saved briefs yet. Create one to calibrate its research and writing stages.</p>}
    </div>
  </section>;
}
