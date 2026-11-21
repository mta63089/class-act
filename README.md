# The Class Act Daily — phase 2: private CMS + owner login

This **patch** builds on your working Next.js / Tailwind v4 / Drizzle / D1 project.

**Important:** It contains only new and modified files. It intentionally **does not include** `wrangler.jsonc`, `.env.local`, `package-lock.json`, old source components, or existing migrations. Keep your already-working `DB` binding and real Cloudflare database ID unchanged.

## Delivered

- Better Auth with D1/Drizzle; sign-in only. No public sign-up endpoint.
- One-time `/admin/setup` screen protected by a high-entropy setup token. Setup closes when a CMS user exists.
- Protected `/admin` area with draft inbox, story-idea inbox, and generation-request queue.
- Manual article creation, private preview, and revision history (plain-paragraph articles).
- Topic + framing + instructions request form. Requests are **queued in D1 only** — no AI research/generation yet.
- Public article pages and seed.json remain unchanged. There is NO approval/publishing API in this patch.

## Local installation

1. **Copy the contents of this patch folder into your existing `class-act` folder**, keeping your existing `wrangler.jsonc`, `drizzle/`, and `.env.local` unchanged. The patch intentionally includes a replacement `package.json`, `next.config.ts`, and `drizzle.config.ts`.
2. `npm install`
3. Add the following to your existing `.env.local` (do not overwrite any other variables):

   ```env
   BETTER_AUTH_URL=http://localhost:3000
   BETTER_AUTH_SECRET=<random 32+ character secret>
   CMS_SETUP_TOKEN=<different random 32+ character secret>
   ```

   Generate **two different** secrets using `openssl rand -base64 48` (run twice). Never commit secrets.
4. `npm run db:generate`
5. Inspect the new SQL files in `drizzle/` **before applying**. Existing editorial tables must not be dropped.
6. `npm run db:migrate:local`
7. `npm run build` and `npm run dev`
8. Open `http://localhost:3000/admin/setup` and register your owner account using the `CMS_SETUP_TOKEN`. Then sign in at `/admin/login`.

### Check the database

`npm run db:tables` should show existing editorial tables and the new Better Auth `user`, `session`, `account`, and `verification` tables. If the site cannot connect to D1 in `next dev`, ensure your `next.config.ts` matches the patch and the local database migration succeeded.

### Important production notes

- This is a local-test patch. **Do not deploy the CMS before validating authentication and reviewing migrations**.
- In production, set `BETTER_AUTH_URL` to the exact HTTPS site URL and set `BETTER_AUTH_SECRET` and `CMS_SETUP_TOKEN` as Wrangler Worker secrets, not checked-in files. Use separate production secrets from local development.
- Local D1 is separate from remote D1. Run remote migrations **only** after reviewing the generated SQL and explicitly choosing to deploy.
- The manual draft editor supports paragraphs only; a structured editor supporting sourced quotes, headings, rich formatting, revision requests and explicit approval will follow.
- The public website intentionally still reads `seed.json`. The article pipeline will only be hooked into the public site after the review/publish system is complete.
- Never commit `.env.local`, `.dev.vars` or secrets to GitHub.

## Editorial pipeline status

| Stage | Status |
| --- | --- |
| CMS login | Added |
| One-time owner setup | Added |
| Manual draft creation + revisions | Added |
| Private draft and idea inbox | Added |
| Save topic/framing generation requests | Added (queued, not processed) |
| Scheduled RSS/scraping | Not implemented |
| AI research, source checking and drafting | Not implemented |
| Structured AI revision requests | Not implemented |
| Quote verification + approval UI | Not implemented |
| Publish from D1 to public site | Not implemented |
