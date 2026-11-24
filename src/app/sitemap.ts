export const dynamic = "force-dynamic";

import type { MetadataRoute } from "next";
import { getStories, sectionUrl, SECTIONS, storyUrl } from "@/lib/stories";
import { fullUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const stories = await getStories();
  return [
    ...["/", "/archive", "/about", ...SECTIONS.map(sectionUrl)].map((path) => ({ url: fullUrl(path) })),
    ...stories.filter(story => story.kind !== "Demo Article").map((story) => ({ url: fullUrl(storyUrl(story)), lastModified: new Date(`${story.date}T00:00:00Z`) })),
  ];
}
