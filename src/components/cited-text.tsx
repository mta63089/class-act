import type { EvidenceSource } from "@/lib/ai-editorial";

/** Clickable evidence citations for the private article preview. */
export function CitedText({ text, sources }: { text: string; sources: EvidenceSource[] }) {
  return <>{text.split(/(\[\d{1,2}\])/g).map((part, index) => {
    const match = /^\[(\d{1,2})\]$/.exec(part);
    const number = match ? Number(match[1]) : 0;
    const source = number > 0 ? sources[number - 1] : undefined;
    return source ? <a key={index} className="font-bold underline underline-offset-2" href={source.url}
      target="_blank" rel="noopener noreferrer" title={source.title}>{part}</a> : <span key={index}>{part}</span>;
  })}</>;
}
