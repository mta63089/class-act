# The Class Act Daily — Phase 4 (no-cost mock generator + editorial CMS pipeline)

This is a **patch** for your existing Phase 3 Next.js project. It keeps Better Auth, Drizzle/D1, your Tailwind design, and your local admin account intact. Do not copy any existing `.env.local`, `wrangler.jsonc`, or migrations from another project.

## 1. Apply and run locally

Copy this patch's files into the root of your `class-act` checkout, replacing matching files. Do not replace your `.env.local`, `wrangler.jsonc`, or migrations. Add to `.env.local`:

```env
AI_PROVIDER=mock
```

Then:

```bash
pnpm install
pnpm dev
```

You no longer need `OPENAI_API_KEY` for normal local testing; it is ignored unless you deliberately choose `AI_PROVIDER=openai` later. **The mock is also the default if `AI_PROVIDER` is absent.** It never calls a paid AI API.

To verify source/tests locally:

```bash
pnpm run test:mock
pnpm run test:editorial
node --test tests/ai-editorial.test.cjs
pnpm typecheck
pnpm build
```

## 2. Test the editorial workflow

1. Open `/admin/new`. Enter a topic and framing, then **Generate demo draft**.
2. The draft opens in `/admin/articles/<id>`, with a visible demo label and several topic-specific placeholder paragraphs.
3. Try **Suggest changes** and **Save manual revision**. Every saved revision increments the version and clears any previous approval.
4. Select **Approve this revision** and then **Publish approved article**. The public article appears on `/stories/<slug>`, the homepage, archive, and its category. You can view it via **All articles**.
5. Drafts cannot appear on the public site. Demo content is marked as fake. Demo articles are excluded from XML sitemap and RSS, and their article metadata is `noindex`. Production prevents demo publication by default.

**Important:** Demo revisions append a visible editorial placeholder note rather than pretending to have performed AI rewriting. No quotations or source citations are fabricated. You are testing the process, not article quality.

## 3. Test idea discovery and editorial settings

- `/admin/ideas`: **Add sample ideas** without contacting external services. Turn one into an article brief; it appears in the review inbox generation queue.
- `/admin/sources`: Add a public HTTPS RSS/Atom feed, choose its check interval, and **Check enabled feeds now**. Discovered headlines become unpublished idea records with source links. Feed checks use an ordinary HTTP fetch and cost no AI tokens. Respect publisher permissions and terms.
- `/admin/settings`: Store newsroom writing instructions and enable/disable scheduled *discovery*. AI generation continues to require a click in the CMS. The human review requirement is not configurable off.

The test feeds feature uses `fast-xml-parser` (added to `package.json`). It supports standard RSS and Atom; some unusual feeds may need parser improvements.

## 4. Scheduling — later, after production D1 setup

`wrangler.scheduler.jsonc` defines a **separate** Cloudflare Worker with a 15-minute Cron Trigger. Per-source polling interval controls which enabled feeds are due; the `/admin/settings` switch enables or disables scheduled checks. The scheduled Worker only creates story ideas, never AI drafts or published stories. It is not deployed automatically and is not necessary for local UI testing.

Once you deploy the web application and migrate the **remote** D1 database (which is separate from local D1), you can deploy the scheduler intentionally with:

```bash
pnpm scheduler:deploy
```

Do not deploy the scheduler during local testing. It reads and writes the production D1 database ID in `wrangler.scheduler.jsonc`. Your local CMS settings and source records will not automatically exist in the remote D1 database. The scheduler's cron runs in UTC and its exact interval is configured in the Worker file, not the dashboard. Cloudflare docs: https://developers.cloudflare.com/workers/configuration/cron-triggers/

## Scope and limitations

- **Included:** no-cost topic-based draft mock, mock revision requests, version history preserved, quote verification controls, explicit editorial approval and publish, public D1 published articles, admin article index, RSS source management + feed import, sample ideas, style/settings forms, and an optional scheduled RSS Worker.
- **Not included yet:** automated research or fact checking, live generation, rich text/media upload, full-text public search over D1, editable SEO/social metadata fields, editorial workflow for modifying already-published articles, analytics, ad network integration, or completed Cloudflare production deployment.
- **No database migration:** all functionality uses the editorial tables from Phases 1–2.
- **No GitHub commits:** this patch is for local testing only.
- **No full build validation here:** npm/pnpm registry access was unavailable; syntax and zero-dependency tests passed, but you should run `pnpm install`, `pnpm typecheck`, and `pnpm build` locally before pushing.
- **Do not deploy with demonstration content as reporting.** If you intentionally set `ALLOW_DEMO_PUBLICATION=true` in a production-like environment, demo pages remain labeled and marked noindex, but this option is intended only for an isolated staging site.
