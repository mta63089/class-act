import { generateQueuedArticle } from "@/app/admin/ai-actions";
import { addDemoIdeas, turnIdeaIntoBrief } from "@/app/admin/discovery-actions";
import { AdminPendingButton } from "@/components/admin-pending-button";
import { getDb } from "@/db/client";
import { articles, generationRequests, storyIdeas } from "@/db/schema";
import { desc, isNotNull } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function IdeasPage({
  searchParams,
}: {
  searchParams: Promise<{ generation?: string }>;
}) {
  const db = await getDb();
  const [ideas, requests, drafts, query] = await Promise.all([
    db.select().from(storyIdeas).orderBy(desc(storyIdeas.discoveredAt)),
    db.select().from(generationRequests).orderBy(desc(generationRequests.createdAt)),
    db
      .select({
        id: articles.id,
        title: articles.title,
        generationRequestId: articles.generationRequestId,
      })
      .from(articles)
      .where(isNotNull(articles.generationRequestId)),
    searchParams,
  ]);

  const manualBriefs = requests.filter((request) => request.origin === "manual");
  const requestByIdea = new Map(
    requests
      .filter((request) => request.ideaId)
      .map((request) => [request.ideaId, request]),
  );
  const draftByRequest = new Map(
    drafts.map((draft) => [draft.generationRequestId, draft]),
  );

  function requestControls(request: (typeof requests)[number]) {
    const draft = draftByRequest.get(request.id);
    const canGenerate =
      request.status === "queued" ||
      (request.status === "failed" &&
        !request.errorMessage?.includes("already has a draft"));

    return (
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {draft ? (
          <Link
            href={`/admin/articles/${draft.id}`}
            className="border-2 border-ink bg-sun px-3 py-2 text-xs font-black no-underline shadow-[2px_2px_0_#1b1818]"
          >
            Open article draft
          </Link>
        ) : canGenerate ? (
          <form action={generateQueuedArticle}>
            <input type="hidden" name="id" value={request.id} />
            <AdminPendingButton
              idle={request.status === "failed" ? "Retry generation" : "Generate article"}
              busy="Generating…"
              className="px-3 py-2 text-xs"
            />
          </form>
        ) : request.status === "running" ? (
          <span className="text-xs font-semibold">Generation in progress</span>
        ) : (
          <span className="text-xs font-semibold">No draft linked yet</span>
        )}
        <span className="bg-lilac px-2 py-1 text-xs font-black uppercase">
          {request.status}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest">Editorial planning</p>
          <h2 className="font-display text-4xl font-black uppercase">Story ideas</h2>
          <p className="mt-2 max-w-2xl text-sm">
            Manual briefs and discovered stories live here, even after they move into
            generation. Actual article drafts go to the review inbox.
          </p>
        </div>
        <Link
          href="/admin/new"
          className="border-2 border-ink bg-sun px-4 py-3 text-sm font-black no-underline shadow-[3px_3px_0_#1b1818]"
        >
          Add article brief
        </Link>
      </div>

      {query.generation === "failed" && (
        <p role="alert" className="border-l-4 border-pop-red bg-card p-4 text-sm font-bold">
          Generation failed. Find the request below to see the error and retry.
        </p>
      )}

      <section aria-labelledby="manual-briefs-title">
        <div className="mb-4 flex items-center justify-between border-b-2 border-ink pb-3">
          <h3 id="manual-briefs-title" className="font-display text-3xl font-black uppercase">
            Your saved briefs ({manualBriefs.length})
          </h3>
        </div>
        <div className="space-y-4">
          {manualBriefs.map((request) => (
            <article key={request.id} className="border-[3px] border-ink bg-card p-5 shadow-[3px_3px_0_#1b1818]">
              <p className="text-xs font-bold uppercase tracking-wide">Manual idea · {request.createdAt}</p>
              <h4 className="mt-2 font-display text-2xl font-extrabold leading-tight">
                {request.topicPrompt}
              </h4>
              {request.requestedFraming && (
                <p className="mt-2 text-sm"><strong>Framing:</strong> {request.requestedFraming}</p>
              )}
              {request.additionalInstructions && (
                <p className="mt-2 whitespace-pre-wrap text-sm"><strong>Instructions:</strong> {request.additionalInstructions}</p>
              )}
              {request.status === "failed" && request.errorMessage && (
                <p role="alert" className="mt-3 border-l-4 border-pop-red p-2 text-xs font-semibold">
                  {request.errorMessage}
                </p>
              )}
              {requestControls(request)}
            </article>
          ))}
          {!manualBriefs.length && (
            <div className="border-[3px] border-dashed border-ink bg-card p-6 text-sm">
              You haven't saved any manual briefs yet.
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby="discovered-ideas-title">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink pb-3">
          <h3 id="discovered-ideas-title" className="font-display text-3xl font-black uppercase">
            Discovered ideas ({ideas.length})
          </h3>
          <div className="flex flex-wrap gap-3">
            <form action={addDemoIdeas}>
              <button className="border-2 border-ink bg-lilac px-3 py-2 text-xs font-black">
                Add sample ideas
              </button>
            </form>
            <Link href="/admin/sources" className="border-2 border-ink bg-white px-3 py-2 text-xs font-black no-underline">
              Manage RSS sources
            </Link>
          </div>
        </div>
        <div className="space-y-4">
          {ideas.map((idea) => {
            const request = requestByIdea.get(idea.id);
            return (
              <article key={idea.id} className="border-[3px] border-ink bg-card p-5 shadow-[3px_3px_0_#1b1818]">
                <div className="flex flex-wrap gap-2 text-xs font-black uppercase">
                  <span>{idea.section || "Uncategorized"}</span>
                  <span className="bg-lilac px-2 py-1">{idea.status}</span>
                </div>
                <h4 className="mt-2 font-display text-2xl font-extrabold leading-tight">{idea.headline}</h4>
                <p className="mt-2 text-sm">{idea.summary}</p>
                {idea.suggestedAngle && (
                  <p className="mt-2 text-sm"><strong>Suggested angle:</strong> {idea.suggestedAngle}</p>
                )}
                {idea.sourceUrl && (
                  <a href={idea.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-bold underline">
                    Original source
                  </a>
                )}
                {request ? (
                  requestControls(request)
                ) : (idea.status === "new" || idea.status === "selected") ? (
                  <form action={turnIdeaIntoBrief} className="mt-4">
                    <input type="hidden" name="id" value={idea.id} />
                    <button className="border-2 border-ink bg-sun px-3 py-2 text-xs font-black shadow-[2px_2px_0_#1b1818]">
                      Create article brief
                    </button>
                  </form>
                ) : null}
              </article>
            );
          })}
          {!ideas.length && (
            <div className="border-[3px] border-dashed border-ink bg-card p-6 text-sm">
              No RSS or sample ideas discovered yet. You can save a manual brief above.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
