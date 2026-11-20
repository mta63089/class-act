import Link from "next/link";
import SearchDialog from "./search-dialog";
import { getStories, dateLabel, sectionUrl, SECTIONS } from "@/lib/stories";

export default async function SiteHeader() {
  const stories = await getStories();
  const issueDate = stories[0]?.date ?? new Date().toISOString().slice(0, 10);

  return (
    <header>
      <div className="top">
        <div className="wrap">
          <span>✦ &nbsp; INDEPENDENT DIGITAL NEWSROOM</span>
          <span>{dateLabel(issueDate).toUpperCase()}</span>
        </div>
      </div>
      <div className="mast wrap">
        <span className="burst" aria-hidden="true">✷</span>
        <Link className="brand" href="/" aria-label="The Class Act home">THE CLASS <i>ACT</i></Link>
        <span className="burst right" aria-hidden="true">✦</span>
        <p className="strap">Politics, power &amp; the people who do the work.</p>
      </div>
      <nav className="nav" aria-label="Main navigation">
        <div className="wrap">
          <Link href="/">Front Page</Link>
          {SECTIONS.map((section) => <Link key={section} href={sectionUrl(section)}>{section}</Link>)}
          <Link href="/about">About</Link>
          <SearchDialog stories={stories.map(({ slug, title, dek, section }) => ({ slug, title, dek, section }))} />
        </div>
      </nav>
    </header>
  );
}
