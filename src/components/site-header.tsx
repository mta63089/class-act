import Link from "next/link";
import SearchDialog from "./search-dialog";
import { getStories, dateLabel, sectionUrl, SECTIONS } from "@/lib/stories";
import { container } from "@/lib/ui";

const navItem = "text-[13px] font-extrabold uppercase tracking-[.08em] no-underline hover:text-[#ab2517] aria-[current=page]:text-[#ab2517] max-[651px]:text-[11px]";

export default async function SiteHeader() {
  const stories = await getStories();
  const issueDate = stories[0]?.date ?? new Date().toISOString().slice(0, 10);

  return (
    <header>
      <div className="bg-ink text-white text-[12px] font-extrabold tracking-[.13em] max-[651px]:text-[10px]">
        <div className={`${container} flex h-[35px] items-center justify-between max-[651px]:h-[31px]`}>
          <span className="text-sun">✦ &nbsp; INDEPENDENT DIGITAL NEWSROOM</span>
          <span>{dateLabel(issueDate).toUpperCase()}</span>
        </div>
      </div>
      <div className={`${container} relative pt-4 pb-[18px] text-center`}>
        <span className="absolute top-[40%] left-[6%] -rotate-[13deg] text-[49px] leading-none text-pop-red max-[651px]:hidden" aria-hidden="true">✷</span>
        <Link className="inline-block font-display text-[clamp(72px,10.4vw,155px)] leading-[.84] font-black tracking-[-.045em] uppercase no-underline max-[651px]:text-[clamp(54px,15vw,90px)]" href="/" aria-label="The Class Act home">
          THE CLASS <i className="not-italic text-pop-red">ACT</i>
        </Link>
        <span className="absolute top-[40%] right-[6%] -rotate-[13deg] text-[37px] leading-none text-[#6e46da] max-[651px]:hidden" aria-hidden="true">✦</span>
        <p className="mt-[13px] text-[13px] font-extrabold tracking-[.18em] uppercase max-[651px]:text-[10px]">Politics, power &amp; the people who do the work.</p>
      </div>
      <nav className="border-y-[3px] border-ink" aria-label="Main navigation">
        <div className={`${container} flex min-h-[44px] flex-wrap items-center justify-center gap-x-[clamp(14px,3.1vw,45px)] max-[651px]:gap-x-[15px] max-[651px]:gap-y-[6px] max-[651px]:py-[7px]`}>
          <Link className={navItem} href="/">Front Page</Link>
          {SECTIONS.map((section) => <Link className={navItem} key={section} href={sectionUrl(section)}>{section}</Link>)}
          <Link className={navItem} href="/about">About</Link>
          <SearchDialog className={navItem} stories={stories.map(({ slug, title, dek, section }) => ({ slug, title, dek, section }))} />
        </div>
      </nav>
    </header>
  );
}
