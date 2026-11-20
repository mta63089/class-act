import Image from "next/image";
import Link from "next/link";
import { getStories, imageUrl, storyUrl } from "@/lib/stories";
import StoryGrid from "@/components/story-grid";
import ArticleMeta from "@/components/article-meta";
import { SITE_DESCRIPTION, SITE_NAME, fullUrl } from "@/lib/site";

export default async function Home() {
  const stories = await getStories();
  const [lead, ...rest] = stories;
  if (!lead) return <div className="wrap section"><h1>No stories yet</h1></div>;
  const latest = rest.slice(0, 9);

  const schema = { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: fullUrl("/"), description: SITE_DESCRIPTION };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
      <div className="ticker">
        <div className="wrap">
          <strong>THE WIRE</strong>
          {rest.slice(0, 3).map((story) => (
            <span className="ticker-item" key={story.slug}>
              <b aria-hidden="true">✦</b><Link href={storyUrl(story)}>{story.title}</Link>
            </span>
          ))}
        </div>
      </div>
      <article className="hero wrap">
        <figure><Image src={imageUrl(lead)} alt={lead.alt} width={1100} height={700} priority unoptimized /></figure>
        <div className="hero-copy">
          <span className="label">★ &nbsp; {lead.kind}</span>
          <h1>{lead.title}</h1>
          <p>{lead.dek}</p>
          <ArticleMeta story={lead} />
          <Link className="cta" href={storyUrl(lead)}>Read the story</Link>
        </div>
      </article>
      <section className="wrap section">
        <div className="section-head">
          <h2><span aria-hidden="true" style={{ color: "#b12b23" }}>✦</span> The Latest</h2>
          <Link href="/archive">All stories</Link>
        </div>
        <StoryGrid stories={latest} />
      </section>
    </>
  );
}
