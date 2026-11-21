import { fullUrl } from "@/lib/site";
import { getStories, SECTIONS, sectionUrl, storyUrl } from "@/lib/stories";
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const stories = await getStories();
  return [
    ...["/", "/archive", "/about", ...SECTIONS.map(sectionUrl)].map((path) => ({
      url: fullUrl(path),
    })),
    ...stories.map((story) => ({
      url: fullUrl(storyUrl(story)),
      lastModified: new Date(`${story.date}T00:00:00Z`),
    })),
  ];
}
