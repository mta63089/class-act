import type { ArticleBlock } from "@/db/schema";

/** Safely accept only the block types and fields the public renderer knows. */
export function validateArticleBlocks(input: unknown): ArticleBlock[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > 160) {
    throw new Error("An article requires between 1 and 160 blocks.");
  }
  const text = (value: unknown, label: string, limit: number): string => {
    if (typeof value !== "string" || !value.trim() || value.length > limit) {
      throw new Error(`Invalid ${label} (maximum ${limit} characters).`);
    }
    return value.trim();
  };
  const optional = (value: unknown, label: string, limit: number) =>
    value == null || value === "" ? "" : text(value, label, limit);
  const url = (value: unknown, label: string, local = false) => {
    const raw = text(value, label, 2000);
    if (
      local &&
      /^\/assets\/[a-z0-9_-]+\.(?:webp|png|jpg|jpeg|avif)$/i.test(raw)
    )
      return raw;
    try {
      const parsed = new URL(raw);
      if (parsed.protocol === "https:" && !parsed.username && !parsed.password)
        return parsed.toString();
    } catch {
      /* reject below */
    }
    throw new Error(
      `${label} must be an HTTPS URL${local ? " or a local /assets image" : ""}.`,
    );
  };
  return input.map((item: unknown, index: number): ArticleBlock => {
    if (!item || typeof item !== "object")
      throw new Error(`Invalid block ${index + 1}.`);
    const b = item as Record<string, unknown>;
    switch (b.type) {
      case "paragraph":
        return { type: "paragraph", text: text(b.text, "paragraph", 6000) };
      case "heading": {
        if (b.level !== 2 && b.level !== 3)
          throw new Error("Use H2 or H3 headings only.");
        return {
          type: "heading",
          text: text(b.text, "heading", 180),
          level: b.level,
        };
      }
      case "list": {
        if (
          !Array.isArray(b.items) ||
          b.items.length < 1 ||
          b.items.length > 20
        )
          throw new Error("Lists must contain 1–20 items.");
        return {
          type: "list",
          items: b.items.map((it: unknown) => text(it, "list item", 1200)),
        };
      }
      case "quote":
        return {
          type: "quote",
          quoteId: text(b.quoteId, "quote ID", 100),
          text: text(b.text, "quote", 1800),
          attribution: text(b.attribution, "quote attribution", 180),
        };
      case "pullquote":
        return { type: "pullquote", text: text(b.text, "pull quote", 700) };
      case "image":
      case "split": {
        const media = {
          src: url(b.src, "Image URL", true),
          alt: text(b.alt, "image alt text", 250),
          caption: optional(b.caption, "caption", 600),
          credit: text(b.credit, "image credit / license attribution", 300),
          ...(b.sourceUrl
            ? { sourceUrl: url(b.sourceUrl, "image source URL") }
            : {}),
        };
        if (b.type === "image") return { type: "image", ...media };
        if (b.position !== "left" && b.position !== "right")
          throw new Error("Invalid split layout.");
        return {
          type: "split",
          ...media,
          position: b.position,
          text: text(b.text, "split text", 4500),
        };
      }
      case "imageIdea":
        return {
          type: "imageIdea",
          prompt: text(b.prompt, "image idea", 1200),
          placementNote: optional(b.placementNote, "placement note", 400),
        };
      default:
        throw new Error(`Unsupported block type at position ${index + 1}.`);
    }
  });
}

export function articleWordCount(blocks: ArticleBlock[]) {
  const text = blocks
    .map((b) =>
      b.type === "paragraph" ||
      b.type === "heading" ||
      b.type === "pullquote" ||
      b.type === "quote"
        ? b.text
        : b.type === "split"
          ? b.text
          : b.type === "list"
            ? b.items.join(" ")
            : "",
    )
    .join(" ")
    .trim();
  return text ? text.split(/\s+/).length : 0;
}

export function unfinishedImageIdeas(blocks: ArticleBlock[]) {
  return blocks.filter((b) => b.type === "imageIdea").length;
}

export function firstEditorialImage(blocks: ArticleBlock[]) {
  return blocks.find(
    (b): b is Extract<ArticleBlock, { type: "image" | "split" }> =>
      b.type === "image" || b.type === "split",
  );
}
