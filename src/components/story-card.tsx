import Link from "next/link";
import Image from "next/image";
import type { Story } from "@/lib/stories";
import { storyUrl, imageUrl } from "@/lib/stories";
import ArticleMeta from "./article-meta";

export default function StoryCard({ story }: { story: Story }) {
  return (
    <article className="card">
      <Link href={storyUrl(story)}>
        <Image src={imageUrl(story)} alt={story.alt} width={1100} height={700} unoptimized />
        <div className="copy">
          <span className="label">{story.section}</span>
          <h3>{story.title}</h3>
          <p>{story.dek}</p>
          <ArticleMeta story={story} />
        </div>
      </Link>
    </article>
  );
}
