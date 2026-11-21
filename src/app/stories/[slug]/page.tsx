import ArticleMeta from "@/components/article-meta";
import { SITE_NAME, fullUrl } from "@/lib/site";
import {
  getStories,
  getStory,
  imageUrl,
  sectionUrl,
  storyUrl,
} from "@/lib/stories";
import {
  article,
  articleDek,
  articleHeading,
  articleImage,
  articleTitle,
  container,
  storyLabel,
} from "@/lib/ui";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return (await getStories()).map((story) => ({ slug: story.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const story = await getStory(slug);
  if (!story) return {};
  return {
    title: story.title,
    description: story.dek,
    alternates: { canonical: storyUrl(story) },
    openGraph: {
      type: "article",
      title: story.title,
      description: story.dek,
      publishedTime: `${story.date}T00:00:00Z`,
      images: [{ url: imageUrl(story), alt: story.alt }],
    },
  };
}

export default async function StoryPage({ params }: Props) {
  const { slug } = await params;
  const story = await getStory(slug);
  if (!story) notFound();

  const schema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: story.title,
    description: story.dek,
    datePublished: story.date,
    image: [fullUrl(imageUrl(story))],
    mainEntityOfPage: fullUrl(storyUrl(story)),
    articleSection: story.section,
    author: {
      "@type": "Organization",
      name:
        story.authorship === "Staff" ? SITE_NAME : `${SITE_NAME} AI Newsroom`,
      url: fullUrl("/about"),
    },
    publisher: { "@type": "Organization", name: SITE_NAME, url: fullUrl("/") },
    citation: story.sources.map((source) => source[1]),
  };

  return (
    <div className={container}>
      <script
        type='application/ld+json'
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
        }}
      />
      <article className={article}>
        <Link
          className={`${storyLabel} no-underline`}
          href={sectionUrl(story.section)}
        >
          {story.section}
        </Link>
        <h1 className={articleTitle}>{story.title}</h1>
        <p className={articleDek}>{story.dek}</p>
        <p className='mb-[1em]'>
          <ArticleMeta story={story} kind />
        </p>
        <Image
          className={articleImage}
          src={imageUrl(story)}
          alt={story.alt}
          width={1100}
          height={700}
          priority
          unoptimized
        />
        <div className='text-[19px] [&_p]:mb-[1em]'>
          {story.body.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
        {story.sources.length > 0 && (
          <>
            <h2 className={articleHeading}>Sources and further reading</h2>
            <ul className='mb-[1em] list-disc pl-10'>
              {story.sources.map(([title, url]) => (
                <li className='wrap-anywhere' key={url}>
                  <a
                    className='underline'
                    href={url}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    {title}
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
        {story.authorship !== "Staff" && (
          <p className='mb-[1em] border-2 border-ink bg-lilac p-[13px] text-[14px]'>
            Written with AI. This piece offers analysis from a leftist,
            class-focused editorial perspective.
          </p>
        )}
      </article>
    </div>
  );
}
