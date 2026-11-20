# The Class Act — Next.js + Tailwind CSS v4

This project converts the original static magazine into **Next.js App Router, React, TypeScript, and Tailwind CSS v4**. The magazine layout, graphics, SEO routes, search dialog, typography, and article content remain the same.

## Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Browse http://localhost:3000 and verify the homepage, archive, sections, stories, and search modal.

**Existing GitHub clone:** unzip the contents over your local clone, then run `npm install` to update `package-lock.json` for the new Tailwind packages. The ZIP intentionally does not ship a stale lockfile from before the migration. When you're happy with the local results, commit the changed files and updated lockfile yourself.

## Styling

- Uses the **Tailwind v4 PostCSS plugin**, `@import "tailwindcss"` and CSS-first `@theme` design tokens. No `tailwind.config.js` is needed.
- All visual layout, spacing, type sizes, backgrounds, borders, and responsive breakpoints are now composed from Tailwind classes in TSX.
- `src/lib/ui.ts` contains reusable groups of **utility classes** for the layout container, headings, labels, and article typography; this is not a CSS stylesheet.
- `src/app/globals.css` now holds only the Tailwind import, custom theme palette/font families, and small global focus/touch-accessibility rules.
- Google Fonts are still loaded through CSS as they were in the existing site, so they require a network connection to render.

## Routes

- `/` — lead article, news wire, latest cards
- `/archive` — all stories
- `/sections/[section]` — politics, labor, economy, culture
- `/stories/[slug]` — story content and sources, metadata and NewsArticle JSON-LD
- `/about` — editorial policy
- `/feed.xml`, `/sitemap.xml`, `/robots.txt` — unchanged
- Search — client-side dialog for the seeded story collection

## Cloudflare Workers

The existing `open-next.config.ts`, `wrangler.jsonc` and scripts remain in place. For a Cloudflare runtime check, use `npm run preview`. This migration does not implement a CMS, database, authentication, scraping, AI writing, or scheduling.

Set `NEXT_PUBLIC_SITE_URL` to your production URL before building for production so canonical, OG, RSS, and sitemap links are correct.

## Notes

- The provided project was assembled from the matching local source of `mta63089/class-act` without making any GitHub changes.
- This environment could not install npm dependencies from the registry, so a full Next.js build and pixel comparison must still be validated locally.
