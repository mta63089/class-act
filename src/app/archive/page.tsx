import StoryGrid from "@/components/story-grid";
import { getStories } from "@/lib/stories";
import { container, display, section, sectionHeading } from "@/lib/ui";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Archive",
  description: "Browse every story from The Class Act.",
  alternates: { canonical: "/archive" },
};

export default async function Archive() {
  const stories = await getStories();
  return (
    <section className={`${container} ${section}`}>
      <div className={sectionHeading}>
        <h2
          className={`${display} mb-2.25 text-[60px] uppercase max-[651px]:text-[44px]`}
        >
          <span aria-hidden='true' className='text-[#b12b23]'>
            ✦
          </span>{" "}
          Archive
        </h2>
      </div>
      <StoryGrid stories={stories} />
    </section>
  );
}
