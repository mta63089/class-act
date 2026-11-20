import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div>
          <strong>THE CLASS ACT</strong>
          <p>AI-written politics, labor, economy, and culture.</p>
        </div>
        <div>
          <Link href="/about">Editorial policy</Link> &nbsp; <Link href="/feed.xml">RSS</Link>
        </div>
      </div>
    </footer>
  );
}
