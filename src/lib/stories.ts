import seed from "@/content/seed.json";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { articleSources, articles } from "@/db/schema";

export const SECTIONS = ["Politics", "Labor", "Economy", "Culture"] as const;
export type Section = (typeof SECTIONS)[number];

export interface Story {
  slug: string;
  section: Section;
  kind: string;
  title: string;
  dek: string;
  image: string;
  alt: string;
  date: string;
  body: string[];
  sources: [label: string, url: string][];
  authorship?: "AI" | "Staff";
}

const seededStories: Story[] = seed as Story[];
const validSection = (value: string): Section =>
  SECTIONS.find(section => section === value) || "Politics";
const defaultImage = (section: Section) => ({ Politics: "hero", Labor: "labor", Economy: "economy", Culture: "culture" })[section];

/** All public content must have an explicit published status in D1. */
export async function getStories(): Promise<Story[]> {
  const db = await getDb();
  const records = await db.select().from(articles).where(eq(articles.status, "published"));
  // Demo output is visible only in development unless explicitly enabled for a staging site.
  const published = records.filter(record =>
    record.kind !== "Demo Article" || process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_PUBLICATION === "true"
  );
  const sources = published.length
    ? await db.select().from(articleSources).where(inArray(articleSources.articleId, published.map(record => record.id)))
    : [];
  const byArticle = new Map<string, [string, string][]>();
  for (const source of sources) {
    const list = byArticle.get(source.articleId) ?? [];
    list.push([source.title, source.url]);
    byArticle.set(source.articleId, list);
  }
  const content = published.map((item): Story => {
    const section = validSection(item.section);
    const body = item.body.flatMap(block => {
      if (block.type === "paragraph") return [block.text];
      if (block.type === "heading") return [block.text];
      if (block.type === "quote") return [`“${block.text}” — ${block.attribution}`];
      return block.items.map(text => `• ${text}`);
    });
    return {
      slug: item.slug,
      section,
      kind: item.kind,
      title: item.title,
      dek: item.dek,
      image: item.image || defaultImage(section),
      alt: item.imageAlt || `Illustration for ${item.section}`,
      date: (item.publishedAt || item.createdAt).slice(0, 10),
      body,
      sources: byArticle.get(item.id) || [],
      authorship: item.createdWithAi ? "AI" : "Staff",
    };
  });
  return [...content, ...seededStories.filter(item => !published.some(record => record.slug === item.slug))]
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getStory(slug: string): Promise<Story | undefined> {
  return (await getStories()).find(story => story.slug === slug);
}
export async function getSectionStories(section: Section): Promise<Story[]> {
  return (await getStories()).filter(story => story.section === section);
}
export function storyUrl(story: Story): string { return `/stories/${story.slug}`; }
export function sectionUrl(section: Section): string { return `/sections/${section.toLowerCase()}`; }
export function imageUrl(story: Story): string { return `/assets/${story.image}.webp`; }
export function dateLabel(date: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", dateStyle: "long" })
    .format(new Date(`${date}T12:00:00Z`));
}
export function authorshipLabel(story: Story): string {
  if (story.kind === "Demo Article") return "Demo content";
  return story.authorship === "Staff" ? "Staff-written" : "AI-assisted";
}
