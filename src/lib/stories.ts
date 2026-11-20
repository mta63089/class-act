import seed from "@/content/seed.json";

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

// A single data seam to replace with a D1-backed repository when CMS work begins.
const seededStories: Story[] = seed as Story[];

export async function getStories(): Promise<Story[]> {
  return [...seededStories].sort((a, b) => b.date.localeCompare(a.date));
}

export async function getStory(slug: string): Promise<Story | undefined> {
  return (await getStories()).find((story) => story.slug === slug);
}

export async function getSectionStories(section: Section): Promise<Story[]> {
  return (await getStories()).filter((story) => story.section === section);
}

export function storyUrl(story: Story): string {
  return `/stories/${story.slug}`;
}

export function sectionUrl(section: Section): string {
  return `/sections/${section.toLowerCase()}`;
}

export function imageUrl(story: Story): string {
  return `/assets/${story.image}.webp`;
}

export function dateLabel(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    dateStyle: "long",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function authorshipLabel(story: Story): string {
  return story.authorship === "Staff" ? "Staff-written" : "AI-written";
}
