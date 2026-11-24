import { getDb } from "@/db/client";
import { articles } from "@/db/schema";
import { desc } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";
export default async function AllArticlesPage() {
  const db = await getDb();
  const all = await db
    .select()
    .from(articles)
    .orderBy(desc(articles.updatedAt));
  return (
    <section>
      <div className='mb-5 flex flex-wrap items-center justify-between gap-3'>
        <div>
          <p className='text-xs font-black uppercase tracking-widest'>
            Editorial library
          </p>
          <h2 className='font-display text-4xl font-black uppercase'>
            All articles ({all.length})
          </h2>
        </div>
        <Link
          href='/admin/articles/new'
          className='border-2 border-ink bg-sun px-4 py-2 text-sm font-black no-underline'
        >
          Write manually
        </Link>
      </div>
      <div className='divide-y-2 divide-ink border-[3px] border-ink bg-card'>
        {all.map((item) => (
          <div
            key={item.id}
            className='flex flex-wrap items-center justify-between gap-3 p-4'
          >
            <div className='min-w-0'>
              <p className='mb-1 text-xs font-bold uppercase'>
                {item.section} · {item.status.replaceAll("_", " ")} · v
                {item.currentVersion}
              </p>
              <h3 className='font-display text-2xl font-black'>{item.title}</h3>
              <p className='text-xs'>
                {item.kind === "Demo Article"
                  ? "DEMO / TEST CONTENT"
                  : item.createdWithAi
                    ? "AI-assisted"
                    : "Staff"}{" "}
                · Updated {item.updatedAt}
              </p>
            </div>
            <div className='flex gap-3'>
              <Link
                href={`/admin/articles/${item.id}`}
                className='text-sm font-black underline'
              >
                Review
              </Link>
              {item.status === "published" && (
                <Link
                  href={`/stories/${item.slug}`}
                  className='text-sm font-black underline'
                >
                  Public page
                </Link>
              )}
            </div>
          </div>
        ))}
        {all.length === 0 && (
          <p className='p-8 text-sm'>No articles have been added yet.</p>
        )}
      </div>
    </section>
  );
}
