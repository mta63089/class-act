import ArticleMeta from "@/components/article-meta";
import StoryGrid from "@/components/story-grid";
import { SITE_DESCRIPTION, SITE_NAME, fullUrl } from "@/lib/site";
import { getStories, imageUrl, storyUrl } from "@/lib/stories";
import {
  container,
  display,
  section,
  sectionHeading,
  sectionTitle,
  storyLabel,
} from "@/lib/ui";
import Image from "next/image";
import Link from "next/link";

export default async function Home() {
  const stories = await getStories();
  const [lead, ...rest] = stories;
  if (!lead)
    return (
      <div className={`${container} ${section}`}>
        <h1>No stories yet</h1>
      </div>
    );
  const latest = rest.slice(0, 9);

  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: fullUrl("/"),
    description: SITE_DESCRIPTION,
  };

  return (
    <>
      <script
        type='application/ld+json'
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
        }}
      />
      <div className='overflow-hidden border-b-2 border-ink bg-lilac'>
        <div
          className={`${container} flex min-h-9.5 items-center gap-5 whitespace-nowrap max-[651px]:gap-3`}
        >
          <strong className='bg-ink px-2.25 py-0.75 text-[11px] tracking-widest text-white'>
            THE WIRE
          </strong>
          {rest.slice(0, 3).map((story) => (
            <span
              className='flex items-center gap-5 max-[651px]:gap-3'
              key={story.slug}
            >
              <b className='text-[#7036cb]' aria-hidden='true'>
                ✦
              </b>
              <Link
                className='text-[13px] font-bold no-underline'
                href={storyUrl(story)}
              >
                {story.title}
              </Link>
            </span>
          ))}
        </div>
      </div>
      <article
        className={`${container} mt-8 grid grid-cols-[1.13fr_.87fr] border-[3px] border-ink bg-hero shadow-[6px_6px_0_#1b1818] max-[651px]:mt-4.75 max-[651px]:grid-cols-1`}
      >
        <figure className='flex min-w-0 border-r-[3px] border-ink bg-[#f5ac30] max-[651px]:border-r-0 max-[651px]:border-b-[3px]'>
          <Image
            className='block h-full min-h-97.5 w-full object-cover max-[851px]:min-h-77.5 max-[651px]:aspect-[1.6] max-[651px]:max-h-70 max-[651px]:min-h-0'
            src={imageUrl(lead)}
            alt={lead.alt}
            width={1100}
            height={700}
            priority
            unoptimized
          />
        </figure>
        <div className='self-center p-[clamp(24px,3vw,49px)] max-[851px]:p-5.75'>
          <span className={storyLabel}>★ &nbsp; {lead.kind}</span>
          <h1
            className={`${display} mt-4.25 mb-4 text-[clamp(50px,5.4vw,86px)] max-[851px]:text-[53px] max-[651px]:text-[54px]`}
          >
            {lead.title}
          </h1>
          <p className='mb-3.75 max-w-112.5 text-[17px]'>{lead.dek}</p>
          <ArticleMeta story={lead} />
          <div>
            <Link
              className='mt-4.25 inline-block border-2 border-ink bg-sun px-3.75 py-2.25 text-[13px] font-black text-ink no-underline shadow-[3px_3px_0_#1b1818] transition-[transform,box-shadow,background-color] hover:translate-x-0.5 hover:translate-y-0.5 hover:bg-lilac hover:shadow-[1px_1px_0_#1b1818]'
              href={storyUrl(lead)}
            >
              Read the story
            </Link>
          </div>
        </div>
      </article>
      <section className={`${container} ${section}`}>
        <div className={sectionHeading}>
          <h2 className={sectionTitle}>
            <span aria-hidden='true' className='text-[#b12b23]'>
              ✦
            </span>{" "}
            The Latest
          </h2>
          <Link
            className='text-[13px] font-extrabold underline'
            href='/archive'
          >
            All stories
          </Link>
        </div>
        <StoryGrid stories={latest} />
      </section>
    </>
  );
}
