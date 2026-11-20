import type { Metadata } from "next";
import StoryGrid from "@/components/story-grid";
import { getStories } from "@/lib/stories";

export const metadata: Metadata = {
  title: "Archive",
  description: "Browse every story from The Class Act.",
  alternates: { canonical: "/archive" },
};

export default async function Archive() {
  const stories = await getStories();
  return (
    <section className="section wrap">
      <div className="section-head"><h2 className="display-archive"><span aria-hidden="true" style={{ color: "#b12b23" }}>✦</span> Archive</h2></div>
      <StoryGrid stories={stories} />
    </section>
  );
}
