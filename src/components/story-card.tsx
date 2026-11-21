import type { Story } from "@/lib/stories";
import { imageUrl, storyUrl } from "@/lib/stories";
import { display, storyLabel } from "@/lib/ui";
import Image from "next/image";
import Link from "next/link";
import ArticleMeta from "./article-meta";

const labelColors = ["bg-pop-red", "bg-[#d0eb67]", "bg-lilac"] as const;

export default function StoryCard({
  story,
  index = 0,
}: {
  story: Story;
  index?: number;
}) {
  return (
    <article className='overflow-hidden border-2 border-ink bg-card shadow-[4px_4px_0_#1b1818]'>
      <Link className='group block no-underline' href={storyUrl(story)}>
        <Image
          className='block aspect-[1.95] w-full border-b-2 border-ink object-cover'
          src={imageUrl(story)}
          alt={story.alt}
          width={1100}
          height={700}
          unoptimized
        />
        <div className='px-4.5 pt-4 pb-4.75'>
          <span
            className={`${storyLabel} ${labelColors[index % labelColors.length]}`}
          >
            {story.section}
          </span>
          <h3 className={`${display} my-2.5 text-[33px] group-hover:underline`}>
            {story.title}
          </h3>
          <p className='mb-2.5 text-[15px]'>{story.dek}</p>
          <ArticleMeta story={story} />
        </div>
      </Link>
    </article>
  );
}
