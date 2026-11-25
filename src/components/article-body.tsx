import { CitedText } from "@/components/cited-text";
import type { ArticleBlock } from "@/db/schema";

type Source = { title: string; url: string };

function EditorialImage({
  src,
  alt,
  caption,
  credit,
  sourceUrl,
}: {
  src: string;
  alt: string;
  caption: string;
  credit: string;
  sourceUrl?: string;
}) {
  if (!src)
    return (
      <div className='my-8 border-2 border-dashed border-ink/40 bg-lilac/20 p-8 text-center text-sm font-bold'>
        Select this block to add an image URL, alt text and a credit.
      </div>
    );
  return (
    <figure className='my-9'>
      {/* A validated editor-supplied image may be hosted on the site's CDN or a licensed HTTPS host. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading='lazy'
        decoding='async'
        className='w-full h-auto max-h-162.5 object-cover border-[3px] border-ink'
      />
      {(caption || credit) && (
        <figcaption className='mt-2 text-[13px] leading-relaxed text-ink/70'>
          {caption}
          {caption && credit ? " · " : ""}
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='underline'
            >
              {credit}
            </a>
          ) : (
            credit
          )}
        </figcaption>
      )}
    </figure>
  );
}

/** Shared between published pages and the live-style CMS editor. Pure SSR-friendly HTML. */
export function ArticleBlockView({
  block,
  sources = [],
}: {
  block: ArticleBlock;
  sources?: Source[];
}) {
  switch (block.type) {
    case "paragraph":
      return (
        <p className='mb-6 text-[18px] leading-[1.85] sm:text-[19px]'>
          <CitedText text={block.text} sources={sources} />
        </p>
      );
    case "heading":
      return block.level === 2 ? (
        <h2 className='mt-12 mb-5 font-display text-4xl font-black leading-none'>
          {block.text}
        </h2>
      ) : (
        <h3 className='mt-9 mb-4 font-display text-3xl font-black leading-none'>
          {block.text}
        </h3>
      );
    case "list":
      return (
        <ul className='my-6 list-disc space-y-2 pl-7 text-[18px] leading-relaxed'>
          {block.items.map((item, index) => (
            <li key={index}>
              <CitedText text={item} sources={sources} />
            </li>
          ))}
        </ul>
      );
    case "quote":
      return (
        <blockquote className='my-10 border-l-[6px] border-pop-red bg-lilac/45 p-6'>
          <p className='font-display text-3xl font-bold leading-tight'>
            “{block.text}”
          </p>
          <cite className='mt-3 block text-sm not-italic font-bold'>
            — {block.attribution}
          </cite>
        </blockquote>
      );
    case "pullquote":
      return (
        <aside
          className='my-10 border-y-[3px] border-ink py-6 text-center'
          aria-label='Highlighted excerpt'
        >
          <p className='font-display text-[clamp(2rem,5vw,3.25rem)] font-extrabold leading-[1.05] text-pop-red'>
            “{block.text}”
          </p>
        </aside>
      );
    case "image":
      return <EditorialImage {...block} />;
    case "split":
      return (
        <div
          className={`my-10 grid items-center gap-6 md:grid-cols-2 ${block.position === "right" ? "md:[&>figure]:order-2" : ""}`}
        >
          <EditorialImage {...block} />
          <div className='text-[18px] leading-[1.8]'>
            <CitedText text={block.text} sources={sources} />
          </div>
        </div>
      );
    case "imageIdea":
      return null; // Draft-only instruction. Never publish an unresolved placeholder as reporting.
  }
}

export function ArticleBody({
  blocks,
  sources = [],
}: {
  blocks: ArticleBlock[];
  sources?: Source[];
}) {
  return (
    <div className='editorial-article-body'>
      {blocks.map((block, index) => (
        <ArticleBlockView key={index} block={block} sources={sources} />
      ))}
    </div>
  );
}
