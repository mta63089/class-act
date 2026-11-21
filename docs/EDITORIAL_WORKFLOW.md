# The Class Act Daily — editorial workflow

This is the product specification for the CMS and AI article generator. It reflects the owner's intended workflow; the database phase does **not** implement the UI, models, scraping, or publishing jobs yet.

## Editorial approach

- A left-wing news, analysis, and commentary publication with a distinct voice.
- News reporting should distinguish sourced facts from analysis, criticism, and editorial opinion. Clearly label commentary and satire if used.
- Write original work that adds context and analysis, not low-value paraphrases of other publishers.
- Quotations and factual claims should be traceable to reliable, directly reviewable sources. Never fabricate a speaker, quotation, or source. Maintain the surrounding context; provide source URLs. Unverified quotes must not enter published copy.
- Keep a record of AI-assisted generation and editorial approvals for transparency.

## Flow A — human-initiated generation

1. Sign into `/admin` (authentication is a later phase).
2. Choose **New article → Generate**.
3. Enter topic, explicit framing, optional supporting links, desired section, editorial profile, and extra instructions.
4. A generation request tracks the work. The engine researches evidence, produces a draft, and associates cited sources and candidate quotes.
5. The draft appears in **Review inbox** with a preview and sources panel. No automatic publication.
6. Edit text in place, or send a suggested revision (e.g. “tighten the introduction and add additional sourced context”). Every revision is preserved.
7. Verify direct quotations, review claims, and explicitly approve the **current revision**.
8. Publish immediately or schedule it; edits after approval invalidate that approval.

Example manual request: “An article about reactionary-right backlash over GTA 6 being called ‘woke’, critical of the recurrent outrage around entertainment releases.” The generator must independently locate support for the angle, confirm whether relevant statements were actually made, attribute each quote, and avoid presenting unsupported characterization as fact.

## Flow B — scheduled discovery / suggestion inbox

1. Scheduled fetchers read enabled RSS feeds, APIs, and permitted websites according to source-level frequency.
2. Deduplicate URLs/stories and add candidates to the **Ideas inbox**, with article URLs and suggested angles.
3. The owner may dismiss, edit, or select an idea for article generation. Later, an optional setting may auto-generate some *drafts* from selected ideas.
4. All output follows the same **human review → approval → publication** gate.
5. Scrape run history keeps results and errors visible in the dashboard.

## Dashboard modules

- **Review inbox:** drafts, generated drafts, revision requests, editor notes, source list, quote checks, and preview.
- **Ideas inbox:** topical suggestions, originating sources, deduplication and selection.
- **Editor:** structured article body, metadata, section, hero image, citation/quote references, SEO fields (later schema extension), version history.
- **Generation:** topic prompt, framing, editorial profile, revision requests, job status.
- **Automation settings:** source inventory, fetch intervals, Cron settings, limits, suggested topics, editorial profile, disabled/enabled controls.
- **Publishing:** approval, scheduling and eventual publication history.
- **Authentication:** first-user admin account, user permissions, protected mutations. Authentication and security controls must be implemented **before** exposing CMS routes.

## Data model (D1 + Drizzle)

- `cms_users`: editor identity/roles; **not an authentication implementation**.
- `editorial_profiles`: reusable writing styles, instructions, citation preference.
- `news_sources`, `scrape_runs`: source configuration and crawl audit.
- `story_ideas`: candidate stories from discovery.
- `generation_requests`: both manual topic requests and idea-driven article requests.
- `articles`: current draft/published state, approval and scheduling metadata.
- `article_versions`: immutable copy of each iteration.
- `article_sources`, `article_quotes`: citations, exact quotes, verification state.
- `review_comments`: editor notes, requested revisions and model responses.
- `automation_settings`: configurable recurring discovery and draft generation.
- `editorial_events`: audit history.

## Review and publish invariant

An article can be published only if:

- status is `approved` (or `scheduled` at schedule time),
- its **current version** is the one a named editor approved,
- direct quotations included in that revision have been checked against primary or reliable original sources, and
- the authenticated publishing service independently validates these conditions.

Never rely on an LLM's assertion that a quote was verified. Publishing must happen inside authenticated server-side application logic, not a browser-only button or scheduled generation task. A verified quote marked in the database is a record of a *human* verification step, not an AI claim.

## Implementation phases

1. **Now**: D1/Drizzle schema, Cloudflare binding, review/publishing rules, and local migration scripts. Existing public site stays powered by `seed.json`.
2. Next: secure admin authentication and a basic review queue, then article create/edit/preview. Connect the published-story data seam to D1 after seeding/migration.
3. Later: on-demand generator + sourced research + revisions, and scheduled discovery/generation.
4. Finally: editorial settings, SEO audit, publisher integrations and ad-revenue analytics.
