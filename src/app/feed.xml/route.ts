import { getStories, storyUrl } from "@/lib/stories";
import { SITE_DESCRIPTION, SITE_NAME, fullUrl } from "@/lib/site";

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  }[char] ?? char));
}

export async function GET() {
  const stories = (await getStories()).slice(0, 30);
  const items = stories.map((story) => {
    const url = fullUrl(storyUrl(story));
    return `<item><title>${escapeXml(story.title)}</title><description>${escapeXml(story.dek)}</description><link>${escapeXml(url)}</link><guid>${escapeXml(url)}</guid><pubDate>${new Date(`${story.date}T00:00:00Z`).toUTCString()}</pubDate></item>`;
  }).join("");
  const rss = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escapeXml(SITE_NAME)}</title><link>${escapeXml(fullUrl("/"))}</link><description>${escapeXml(SITE_DESCRIPTION)}</description>${items}</channel></rss>`;
  return new Response(rss, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
