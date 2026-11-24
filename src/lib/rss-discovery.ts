/** RSS/Atom discovery shared by the authenticated CMS and the scheduled Worker. */
import type { D1Database } from "@cloudflare/workers-types";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { XMLParser } from "fast-xml-parser";
import {
  automationSettings,
  newsSources,
  scrapeRuns,
  storyIdeas,
} from "../db/schema";

export type FeedEntry = { headline: string; summary: string; url: string };
const asText = (v: unknown): string => {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (v && typeof v === "object")
    return asText((v as Record<string, unknown>)["#text"]);
  return "";
};
const arr = (v: unknown): Record<string, unknown>[] =>
  (Array.isArray(v) ? v : v ? [v] : []).filter(
    (n): n is Record<string, unknown> => typeof n === "object" && n !== null,
  );

export function acceptableFeedUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443")
    )
      return false;
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      host.endsWith(".localhost")
    )
      return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return false;
    if (host.includes(":")) return false; // do not fetch literal IPv6 addresses
    return true;
  } catch {
    return false;
  }
}

export function parseFeed(xml: string): FeedEntry[] {
  const parsed = new XMLParser({
    ignoreAttributes: false,
    processEntities: true,
    trimValues: true,
  }).parse(xml) as Record<string, unknown>;
  const rss = (parsed.rss || parsed["rdf:RDF"] || {}) as Record<
    string,
    unknown
  >;
  const channel = (rss.channel || rss) as Record<string, unknown>;
  const atom = (parsed.feed || {}) as Record<string, unknown>;
  const entries = [...arr(channel.item), ...arr(atom.entry), ...arr(rss.item)];
  const seen = new Set<string>();
  const results: FeedEntry[] = [];
  for (const item of entries) {
    const links = arr(item.link);
    const link =
      typeof item.link === "string"
        ? item.link
        : links.find((e) => e["@_rel"] === "alternate")?.["@_href"] ||
          links[0]?.["@_href"];
    const url = asText(link).trim();
    const headline = asText(item.title)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 240);
    const summary = asText(item.description || item.summary || item.content)
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 900);
    if (!acceptableFeedUrl(url) || !headline || seen.has(url)) continue;
    seen.add(url);
    results.push({
      url,
      headline,
      summary: summary || "New source item — editorial review required.",
    });
  }
  return results;
}

async function fingerprint(url: string) {
  const buffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(url),
  );
  return Array.from(new Uint8Array(buffer), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}

export async function discoverNews(
  binding: D1Database,
  options: { sourceId?: string; force?: boolean } = {},
) {
  const db = drizzle(binding);
  const [config] = await db
    .select()
    .from(automationSettings)
    .where(eq(automationSettings.name, "news-discovery"))
    .limit(1);
  const cap = Math.max(1, Math.min(config?.maxIdeasPerRun ?? 20, 100));
  const candidates = await db
    .select()
    .from(newsSources)
    .where(
      options.sourceId
        ? and(
            eq(newsSources.id, options.sourceId),
            eq(newsSources.isEnabled, true),
          )
        : eq(newsSources.isEnabled, true),
    );
  let discovered = 0;
  const errors: string[] = [];
  let checked = 0;
  for (const source of candidates) {
    if (discovered >= cap) break;
    if (!source.feedUrl || !acceptableFeedUrl(source.feedUrl)) continue;
    const last = Date.parse(source.lastFetchedAt || "") || 0;
    if (
      !options.force &&
      Date.now() - last < source.pollIntervalMinutes * 60_000
    )
      continue;
    checked++;
    const runId = crypto.randomUUID();
    await db
      .insert(scrapeRuns)
      .values({ id: runId, sourceId: source.id, status: "running" });
    try {
      const response = await fetch(source.feedUrl, {
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
        headers: {
          Accept:
            "application/rss+xml, application/atom+xml, application/xml, text/xml",
        },
      });
      if (!response.ok)
        throw new Error(`Feed returned HTTP ${response.status}`);
      if (Number(response.headers.get("content-length") || 0) > 2_000_000)
        throw new Error("Feed exceeds 2 MB");
      const xml = await response.text();
      if (xml.length > 2_000_000) throw new Error("Feed exceeds 2 MB");
      const items = parseFeed(xml).slice(0, Math.max(0, cap - discovered));
      let added = 0;
      for (const item of items) {
        const result = await db
          .insert(storyIdeas)
          .values({
            id: crypto.randomUUID(),
            headline: item.headline,
            summary: item.summary,
            sourceId: source.id,
            sourceUrl: item.url,
            fingerprint: await fingerprint(item.url),
            status: "new",
          })
          .onConflictDoNothing({ target: storyIdeas.fingerprint })
          .returning({ id: storyIdeas.id });
        added += result.length;
      }
      discovered += added;
      await db
        .update(newsSources)
        .set({
          lastFetchedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(newsSources.id, source.id));
      await db
        .update(scrapeRuns)
        .set({
          status: "completed",
          discoveredCount: added,
          completedAt: new Date().toISOString(),
        })
        .where(eq(scrapeRuns.id, runId));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown feed error";
      errors.push(`${source.name}: ${message}`);
      await db
        .update(scrapeRuns)
        .set({
          status: "failed",
          errorMessage: message.slice(0, 450),
          completedAt: new Date().toISOString(),
        })
        .where(eq(scrapeRuns.id, runId));
    }
  }
  return { checked, discovered, errors };
}
