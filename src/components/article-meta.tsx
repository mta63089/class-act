import { authorshipLabel, dateLabel, type Story } from "@/lib/stories";
import { metadata } from "@/lib/ui";

export default function ArticleMeta({
  story,
  kind = false,
}: {
  story: Story;
  kind?: boolean;
}) {
  return (
    <span className={metadata}>
      <time dateTime={story.date}>{dateLabel(story.date)}</time>{" "}
      <span aria-hidden='true'>·</span> {authorshipLabel(story)}
      {kind ? ` · ${story.kind}` : ""}
    </span>
  );
}
