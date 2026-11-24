export const dynamic = "force-dynamic";

import StoryGrid from "@/components/story-grid";
import {
  getSectionStories,
  SECTIONS,
  sectionUrl,
  type Section,
} from "@/lib/stories";
import {
  container,
  display,
  sectionHeading,
  section as sectionSpacing,
} from "@/lib/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ section: string }> };

function asSection(value: string): Section | undefined {
  return SECTIONS.find(
    (section) => section.toLowerCase() === value.toLowerCase(),
  );
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
    <section className={`${container} ${sectionSpacing}`}>
      <div className={sectionHeading}>
        <h2
          className={`${display} mb-2.25 text-[60px] uppercase max-[651px]:text-[44px]`}
        >
          <span aria-hidden='true' className='text-[#b12b23]'>
            ✦
          </span>{" "}
          {section}
        </h2>
      </div>
      <StoryGrid stories={await getSectionStories(section)} />
    </section>
  );
}
