export const SITE_NAME = "The Class Act";
export const SITE_DESCRIPTION =
  "AI-written politics, labor, economics, and culture. A leftist news magazine about who owns what and who gets a say.";

export function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export function fullUrl(path: string): string {
  return `${siteOrigin()}${path}`;
}
