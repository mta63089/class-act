import { saveManualRevision } from "@/app/admin/actions";
import { getDb } from "@/db/client";
import { articles, articleVersions } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DraftPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await getDb();
  const [article] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);
  if (!article) notFound();
  const versions = await db
    .select({
      version: articleVersions.version,
      createdAt: articleVersions.createdAt,
    })
    .from(articleVersions)
    .where(eq(articleVersions.articleId, id))
    .orderBy(articleVersions.version);
  const canEdit =
    article.status !== "published" &&
    article.status !== "archived" &&
    article.body.every((block) => block.type === "paragraph");
  const body = article.body
    .map((block) => (block.type === "paragraph" ? block.text : ""))
    .filter(Boolean)
    .join("\n\n");
  return (
    <div className='grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px]'>
      <section>
        <Link
          href='/admin/inbox'
          className='mb-3 inline-block text-sm font-black underline'
        >
          Back to review inbox
        </Link>
        <p className='text-xs font-black uppercase tracking-widest'>
          {article.status.replaceAll("_", " ")} · Version{" "}
          {article.currentVersion}
        </p>
        <h2 className='font-display text-4xl font-black uppercase'>
          Edit draft
        </h2>
        {canEdit ? (
          <form
            action={saveManualRevision}
            className='mt-5 grid gap-4 border-[3px] border-ink bg-card p-6 shadow-[4px_4px_0_#1b1818]'
          >
            <input type='hidden' name='id' value={article.id} />
            <label className='grid gap-1 text-sm font-black'>
              Headline
              <input
                name='title'
                required
                defaultValue={article.title}
                maxLength={200}
                className='border-2 border-ink bg-white p-3 font-normal'
              />
            </label>
            <label className='grid gap-1 text-sm font-black'>
              Description
              <textarea
                name='dek'
                required
                rows={2}
                maxLength={600}
                defaultValue={article.dek}
                className='border-2 border-ink bg-white p-3 font-normal'
              />
            </label>
            <label className='grid gap-1 text-sm font-black'>
              Body
              <textarea
                name='body'
                required
                rows={17}
                maxLength={150000}
                defaultValue={body}
                className='border-2 border-ink bg-white p-3 font-normal leading-relaxed'
              />
            </label>
            <p className='text-xs'>
              Saving creates a new immutable revision and invalidates any
              previous approval.
            </p>
            <button className='justify-self-start border-2 border-ink bg-sun px-5 py-3 text-sm font-black shadow-[3px_3px_0_#1b1818]'>
              Save revision
            </button>
          </form>
        ) : (
          <div className='mt-5 border-2 border-ink bg-lilac p-5 text-sm font-bold'>
            This draft contains structured content or is already published. The
            structured article editor will be added in the next phase.
          </div>
        )}
      </section>
      <aside className='self-start space-y-5'>
        <div className='border-[3px] border-ink bg-hero p-5 shadow-[4px_4px_0_#1b1818]'>
          <p className='text-xs font-black tracking-widest uppercase'>
            Saved article preview
          </p>
          <h3 className='mt-2 font-display text-3xl font-black leading-none'>
            {article.title}
          </h3>
          <p className='mt-2 text-sm font-semibold'>{article.dek}</p>
          <div className='mt-4 space-y-3 border-t-2 border-ink pt-4 text-sm'>
            {article.body.map((block, i) =>
              block.type === "paragraph" ? (
                <p key={i}>{block.text}</p>
              ) : block.type === "heading" ? (
                <h4 key={i} className='font-bold'>
                  {block.text}
                </h4>
              ) : block.type === "quote" ? (
                <blockquote
                  key={i}
                  className='border-l-4 border-ink pl-3 italic'
                >
                  {block.text} — {block.attribution}
                </blockquote>
              ) : (
                <ul key={i} className='list-disc pl-5'>
                  {block.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              ),
            )}
          </div>
        </div>
        <div className='border-[3px] border-ink bg-card p-5'>
          <p className='text-xs font-black tracking-widest uppercase'>
            Revision history
          </p>
          <ul className='mt-3 space-y-2 text-sm'>
            {versions.map((version) => (
              <li key={version.version}>
                Version {version.version} · {version.createdAt}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
