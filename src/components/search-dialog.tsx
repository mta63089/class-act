"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { display } from "@/lib/ui";

type SearchItem = { slug: string; title: string; dek: string; section: string };

export default function SearchDialog({ stories, className = "" }: { stories: SearchItem[]; className?: string }) {
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
      <button className={`${className} cursor-pointer border-0 bg-transparent p-[7px]`} type="button" onClick={() => {
        setQuery("");
        modal.current?.showModal();
        requestAnimationFrame(() => input.current?.focus());
      }}>
        <span className="text-[16px]" aria-hidden="true">⌕</span> Search
      </button>
      <dialog id="search" ref={modal} onClose={() => setQuery("")} className="m-auto w-[min(620px,calc(100%-32px))] max-w-none border-[3px] border-ink bg-paper p-6 text-ink shadow-[6px_6px_0_#1b1818] backdrop:bg-[#211b29aa]">
        <form method="dialog"><button className="float-right cursor-pointer border-2 border-ink bg-sun px-1 font-extrabold" aria-label="Close search">×</button></form>
        <h2 className={`${display} mb-[14px] text-[36px]`}>Search the paper</h2>
        <input
          ref={input}
          className="w-full border-2 border-ink bg-white p-[10px]"
          type="search"
          placeholder="Try rent or labor"
          aria-label="Search articles"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <ul className="list-disc pl-5" aria-live="polite">
          {matches.map((story) => (
            <li className="my-2" key={story.slug}>
              <Link className="underline" href={`/stories/${story.slug}`} onClick={() => modal.current?.close()}>{story.title}</Link>
            </li>
          ))}
          {!matches.length && <li className="my-2">No stories match your search.</li>}
        </ul>
      </dialog>
    </>
  );
}
