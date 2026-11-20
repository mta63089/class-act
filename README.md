# The Class Act

```bash
npm install
cp .env.example .env.local
npm run dev
```

Visit <http://localhost:3000>.

## Routes

- `/` — featured story, wire, latest grid
- `/archive` — all articles
- `/sections/[section]` — politics/labor/economy/culture
- `/stories/[slug]` — article, sources, author label, metadata and JSON-LD
- `/about` — editorial policy
- `/feed.xml`, `/sitemap.xml`, `/robots.txt` — generated from the article data
- Search — client-side dialog reading article titles, descriptions, and sections

## Cloudflare Workers (planned production target)

The repository includes an **OpenNext** adapter configuration, which uses the real Next.js build output. It is not tested against a live Cloudflare account in this handoff. Cloudflare currently recommends the **vinext beta** for new projects; OpenNext is still a documented supported deployment path. You can use OpenNext initially, or run vinext compatibility checks once the CMS and database are added.

To test in the Workers runtime:

```bash
npm run preview
```

To deploy after your account is connected:

```bash
npm run deploy
```

Set `NEXT_PUBLIC_SITE_URL` to your real public domain _before_ running the production build. Otherwise canonical, Open Graph, RSS, and sitemap URLs will target localhost.
