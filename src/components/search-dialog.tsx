"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

type SearchItem = { slug: string; title: string; dek: string; section: string };

export default function SearchDialog({ stories }: { stories: SearchItem[] }) {
  const modal = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return stories.filter((story) =>
      words.every((word) => `${story.title} ${story.dek} ${story.section}`.toLowerCase().includes(word))
    ).slice(0, 12);
  }, [query, stories]);

  return (
    <>
      <button type="button" onClick={() => {
        setQuery("");
        modal.current?.showModal();
        requestAnimationFrame(() => input.current?.focus());
      }}>
        <span className="search-icon" aria-hidden="true">⌕</span> Search
      </button>
      <dialog id="search" ref={modal} onClose={() => setQuery("")}>
        <form method="dialog"><button className="close" aria-label="Close search">×</button></form>
        <h2>Search the paper</h2>
        <input
          ref={input}
          type="search"
          placeholder="Try rent or labor"
          aria-label="Search articles"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <ul aria-live="polite">
          {matches.map((story) => (
            <li key={story.slug}>
              <Link href={`/stories/${story.slug}`} onClick={() => modal.current?.close()}>{story.title}</Link>
            </li>
          ))}
          {!matches.length && <li>No stories match your search.</li>}
        </ul>
      </dialog>
    </>
  );
}
