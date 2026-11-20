import type { Metadata } from "next";
import { notFound } from "next/navigation";
import StoryGrid from "@/components/story-grid";
import { getSectionStories, sectionUrl, SECTIONS, type Section } from "@/lib/stories";

type Props = { params: Promise<{ section: string }> };

function asSection(value: string): Section | undefined {
  return SECTIONS.find((section) => section.toLowerCase() === value.toLowerCase());
}

export function generateStaticParams() {
  return SECTIONS.map((section) => ({ section: section.toLowerCase() }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section: slug } = await params;
  const section = asSection(slug);
  if (!section) return {};
  return {
    title: section,
    description: `The latest ${section.toLowerCase()} reporting and analysis from The Class Act.`,
    alternates: { canonical: sectionUrl(section) },
  };
}

export default async function SectionPage({ params }: Props) {
  const { section: slug } = await params;
  const section = asSection(slug);
  if (!section) notFound();
  return (
    <section className="section wrap">
      <div className="section-head"><h2 className="display-archive"><span aria-hidden="true" style={{ color: "#b12b23" }}>✦</span> {section}</h2></div>
      <StoryGrid stories={await getSectionStories(section)} />
    </section>
  );
}
