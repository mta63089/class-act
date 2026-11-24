/** Deterministic demonstration data. No network, AI service, or fabricated quotations. */
export type DemoDraft = {
  title: string;
  dek: string;
  section: "Politics" | "Labor" | "Economy" | "Culture";
  paragraphs: string[];
  quotes: [];
  changeSummary: string;
};

const clean = (value: string) => value.replace(/\s+/g, " ").trim();
const shorten = (value: string, length: number) => clean(value).slice(0, length);

function sectionFor(topic: string): DemoDraft["section"] {
  if (/gaming|gta|movie|television|music|entertainment|celebrity|film|streaming/i.test(topic)) return "Culture";
  if (/union|worker|strike|salary|wage|labor|workplace/i.test(topic)) return "Labor";
  if (/rent|tax|inflation|economy|housing|wealth|price/i.test(topic)) return "Economy";
  return "Politics";
}

export function generateMockArticle(input: { topic: string; framing?: string | null; instructions?: string | null }): DemoDraft {
  const topic = shorten(input.topic, 145) || "An unspecified developing story";
  const angle = shorten(input.framing || "Examine the competing claims and implications", 400);
  const notes = shorten(input.instructions || "Review relevant primary sources before publication", 450);
  return {
    title: `DEMO: ${topic}`.slice(0, 200),
    dek: `Sample editorial preview about ${topic.slice(0, 100)}. Fictional placeholder content; no claims have been researched.`,
    section: sectionFor(topic),
    paragraphs: [
      `DEMONSTRATION ARTICLE — NOT REAL REPORTING. This article exists to test the editorial workflow for the topic: ${topic}. It contains no sourced factual claims or actual quotations.`,
      `The requested editorial framing is: ${angle}. In a real assignment, the newsroom would investigate whether that framing is supported by evidence, distinguish analysis from reporting, and include relevant counterarguments.`,
      `This paragraph demonstrates article formatting, paragraph spacing, and the public article layout. A finished story would explain the most important developments, identify who is affected, and establish when the events happened.`,
      `This placeholder represents the evidence and sourcing section. A real article would link original documents, contemporaneous reporting, and accurately attributed remarks. No public figures or quotations are invented here.`,
      `Additional editorial instructions: ${notes}. The editor can revise this sample, test version history, and review its status without incurring API charges.`,
      `EDITORIAL REVIEW REQUIRED. Replace all demonstration prose with verified, original content before treating it as a real news article.`,
    ],
    quotes: [],
    changeSummary: "Created a deterministic demo draft; no external research performed.",
  };
}

export function reviseMockArticle(input: {
  title: string; dek: string; section: string; paragraphs: string[]; instruction: string;
}): DemoDraft {
  const section = ["Politics", "Labor", "Economy", "Culture"].includes(input.section)
    ? input.section as DemoDraft["section"] : "Politics";
  const instruction = shorten(input.instruction, 400).replace(/[“”"]/g, "'");
  return {
    title: input.title,
    dek: input.dek,
    section,
    paragraphs: [
      ...input.paragraphs,
      `DEMO REVISION NOTE: Editor requested the following change: ${instruction}. In live mode, the draft would be rewritten according to this brief. This note is a placeholder, not reporting.`,
    ],
    quotes: [],
    changeSummary: `Mock revision request recorded: ${instruction.slice(0, 160)}`,
  };
}
