import Link from "next/link";
import { container } from "@/lib/ui";

export default function SiteFooter() {
  return (
    <footer className="bg-ink py-[30px] text-paper">
      <div className={`${container} flex items-center justify-between gap-5 max-[651px]:flex-col max-[651px]:items-start`}>
        <div>
          <strong className="font-display text-[30px] font-black">THE CLASS ACT</strong>
          <p className="mt-1">AI-written politics, labor, economy, and culture.</p>
        </div>
        <div>
          <Link className="text-sun underline" href="/about">Editorial policy</Link> &nbsp; <Link className="text-sun underline" href="/feed.xml">RSS</Link>
        </div>
      </div>
    </footer>
  );
}
