import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ArticleMeta from "@/components/article-meta";
import { getStories, getStory, imageUrl, sectionUrl, storyUrl } from "@/lib/stories";
import { SITE_NAME, fullUrl } from "@/lib/site";

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
      type: "article", title: story.title, description: story.dek,
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
    "@context": "https://schema.org", "@type": "NewsArticle",
    headline: story.title, description: story.dek, datePublished: story.date,
    image: [fullUrl(imageUrl(story))], mainEntityOfPage: fullUrl(storyUrl(story)),
    articleSection: story.section,
    author: { "@type": "Organization", name: story.authorship === "Staff" ? SITE_NAME : `${SITE_NAME} AI Newsroom`, url: fullUrl("/about") },
    publisher: { "@type": "Organization", name: SITE_NAME, url: fullUrl("/") },
    citation: story.sources.map((source) => source[1]),
  };

  return (
    <div className="wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
      <article className="article">
        <Link className="label" href={sectionUrl(story.section)}>{story.section}</Link>
        <h1>{story.title}</h1>
        <p className="dek">{story.dek}</p>
        <p><ArticleMeta story={story} kind /></p>
        <Image src={imageUrl(story)} alt={story.alt} width={1100} height={700} priority unoptimized />
        <div className="body">{story.body.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
        {story.sources.length > 0 && (
          <>
            <h2>Sources and further reading</h2>
            <ul>{story.sources.map(([title, url]) => (
              <li key={url}><a href={url} target="_blank" rel="noopener noreferrer">{title}</a></li>
            ))}</ul>
          </>
        )}
        {story.authorship !== "Staff" && <p className="notice">Written with AI. This piece offers analysis from a leftist, class-focused editorial perspective.</p>}
      </article>
    </div>
  );
}
