import { listReviewInbox } from "@/db/queries";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ generation?: string }>;
}) {
  const [articles, query] = await Promise.all([listReviewInbox(), searchParams]);
  return (
    <section>
      {query.generation === "failed" && (
        <p role="alert" className="mb-5 border-l-4 border-pop-red bg-card p-4 text-sm font-bold">
          Article generation did not complete. <Link href="/admin/ideas" className="underline">Open Story Ideas</Link> to inspect the failed brief and retry.
        </p>
      )}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-widest">Human review required</p>
          <h2 className="font-display text-4xl font-black uppercase">
            Draft inbox <span className="text-pop-red">({articles.length})</span>
          </h2>
          <p className="mt-2 text-sm">Only saved article drafts appear here. Unwritten pitches and generation requests are in Story Ideas.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/ideas" className="border-2 border-ink bg-white px-4 py-2 text-sm font-black no-underline">
            Story ideas
          </Link>
          <Link href="/admin/new" className="border-2 border-ink bg-sun px-4 py-2 text-sm font-black no-underline shadow-[3px_3px_0_#1b1818]">
            Generate an article
          </Link>
        </div>
      </div>
      {articles.length ? (
        <div className="divide-y-2 divide-ink border-[3px] border-ink bg-card">
          {articles.map((article) => (
            <Link key={article.id} href={`/admin/articles/${article.id}`} className="block p-5 no-underline hover:bg-lilac/50">
              <div className="mb-2 flex flex-wrap gap-2 text-xs font-black uppercase tracking-wide">
                <span className="bg-lilac px-2 py-1">{article.status.replaceAll("_", " ")}</span>
                <span>{article.section}</span>
                <span>{article.createdWithAi ? "AI draft" : "Manual draft"}</span>
              </div>
              <h3 className="font-display text-2xl font-extrabold leading-tight">{article.title}</h3>
              <p className="mt-1 text-sm">{article.dek}</p>
              <p className="mt-2 text-xs font-semibold text-ink/70">
                Revision {article.currentVersion} · {article.updatedAt}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="border-[3px] border-dashed border-ink bg-card p-8">
          <h3 className="font-display text-3xl font-black uppercase">Nothing waiting for review</h3>
          <p className="mt-2 text-sm">Generate a draft from one of your saved ideas or write an article manually.</p>
          <Link href="/admin/ideas" className="mt-3 inline-block font-bold underline">Go to Story Ideas</Link>
        </div>
      )}
    </section>
  );
}
