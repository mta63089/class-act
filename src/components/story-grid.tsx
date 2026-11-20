import type { Story } from "@/lib/stories";
import StoryCard from "./story-card";

export default function StoryGrid({ stories }: { stories: Story[] }) {
  return (
    <div className="grid">
      {stories.map((story) => <StoryCard story={story} key={story.slug} />)}
    </div>
  );
}
