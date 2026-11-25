export const dynamic = "force-dynamic";

import { ArticleBody } from "@/components/article-body";
import ArticleMeta from "@/components/article-meta";
import type { ArticleBlock } from "@/db/schema";
import { SITE_NAME, fullUrl } from "@/lib/site";
import { getStory, imageUrl, sectionUrl, storyUrl } from "@/lib/stories";
import {
  article,
  articleDek,
  articleHeading,
  articleTitle,
  container,
  storyLabel,
} from "@/lib/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

function absolute(url: string) {
  return url.startsWith("https://") ? url : fullUrl(url);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const story = await getStory(slug);
  if (!story) return {};
  const image = absolute(imageUrl(story));
  return {
    title: story.title,
    description: story.dek,
    robots:
      story.kind === "Demo Article"
        ? { index: false, follow: false }
        : undefined,
    alternates: { canonical: storyUrl(story) },
    openGraph: {
      type: "article",
      title: story.title,
      description: story.dek,
      url: storyUrl(story),
      siteName: SITE_NAME,
      publishedTime: `${story.date}T00:00:00Z`,
      modifiedTime: story.updatedAt || undefined,
      images: [{ url: image, alt: story.alt }],
    },
    twitter: {
      card: "summary_large_image",
      title: story.title,
      description: story.dek,
      images: [image],
    },
  };
}

export default async function StoryPage({ params }: Props) {
  const { slug } = await params;
  const story = await getStory(slug);
  if (!story) notFound();
  const first = story.blocks?.[0];
  const lead = first?.type === "image" ? first : null;
  const body: ArticleBlock[] = story.blocks
    ? lead
      ? story.blocks.slice(1)
      : story.blocks
    : story.body.map((text) => ({ type: "paragraph" as const, text }));
  const image = absolute(imageUrl(story));
  const schema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: story.title,
    description: story.dek,
    datePublished: story.date,
    dateModified: story.updatedAt || story.date,
    image: [image],
    mainEntityOfPage: fullUrl(storyUrl(story)),
    articleSection: story.section,
    inLanguage: "en-US",
    author: {
      "@type": "Organization",
      name: SITE_NAME,
      url: fullUrl("/about"),
    },
    publisher: { "@type": "Organization", name: SITE_NAME, url: fullUrl("/") },
    citation: story.sources.map(([, url]) => url),
  };
  return (
    <div className={container}>
      {story.kind !== "Demo Article" && (
        <script
          type='application/ld+json'
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
          }}
        />
      )}
      <article className={article}>
        {story.kind === "Demo Article" && (
          <p className='mb-5 border-[3px] border-pop-red bg-sun p-4 text-sm font-black'>
            DEMO / PLACEHOLDER STORY — not verified reporting.
          </p>
        )}
        <Link
          className={`${storyLabel} no-underline`}
          href={sectionUrl(story.section)}
        >
          {story.section}
        </Link>
        <h1 className={articleTitle}>{story.title}</h1>
        <p className={articleDek}>{story.dek}</p>
        <p className='mb-5'>
          <ArticleMeta story={story} kind />
        </p>
        <figure className='mb-9'>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl(story)}
            alt={story.alt}
            width={1100}
            height={700}
            className='w-full h-auto max-h-155 object-cover border-[3px] border-ink'
            fetchPriority='high'
          />
          {lead && (
            <figcaption className='mt-2 text-xs text-ink/70'>
              {lead.caption}
              {lead.caption ? " · " : ""}
              {lead.sourceUrl ? (
                <a
                  href={lead.sourceUrl}
                  className='underline'
                  rel='noopener noreferrer'
                  target='_blank'
                >
                  {lead.credit}
                </a>
              ) : (
                lead.credit
              )}
            </figcaption>
          )}
        </figure>
        <ArticleBody
          blocks={body}
          sources={story.sources.map(([title, url]) => ({ title, url }))}
        />
        {story.sources.length > 0 && (
          <section aria-label='Sources and further reading' className='mt-12'>
            <h2 className={articleHeading}>Sources and further reading</h2>
            <ul className='mb-6 list-disc space-y-2 pl-7'>
              {story.sources.map(([title, url]) => (
                <li className='wrap-break-word' key={url}>
                  <a
                    href={url}
                    className='underline'
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    {title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
        {story.authorship !== "Staff" && (
          <p className='mt-7 border-2 border-ink bg-lilac p-3 text-sm'>
            AI-assisted editorial analysis. Sources and quotations are subject
            to editorial verification.
          </p>
        )}
      </article>
    </div>
  );
}
