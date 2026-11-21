import type { Story } from "@/lib/stories";
import StoryCard from "./story-card";

export default function StoryGrid({ stories }: { stories: Story[] }) {
  return (
    <div className='grid grid-cols-3 gap-5 max-[851px]:gap-[14px] max-[651px]:grid-cols-1'>
      {stories.map((story, index) => (
        <StoryCard story={story} index={index} key={story.slug} />
      ))}
    </div>
  );
}
