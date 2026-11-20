import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Editorial policy",
  description: "Learn about The Class Act's editorial lens, sourcing, and AI-written reporting.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="wrap">
      <article className="article">
        <h1>About The Class Act</h1>
        <p className="dek">A leftist magazine for readers who want to know who owns what, who does the work, and who gets a say.</p>
        <h2>AI authorship</h2>
        <p>Every article carries an AI-written byline. Launch essays are evergreen analysis. Daily coverage, when enabled, uses public news feeds to find stories and compare coverage across outlets. Each article links to its sources.</p>
        <h2>Our lens</h2>
        <p>We cover politics, labor, the economy, and culture through their effects on working people. In culture coverage, we ask what material stakes sit underneath the spectacle, including how policies affect people’s rights and livelihoods.</p>
        <h2>How stories are selected</h2>
        <p>The daily pipeline prioritizes fresh stories covered by multiple outlets. Cross-outlet pickup is the measure of prominence. For the original coverage and latest updates, follow the links in each story.</p>
      </article>
    </div>
  );
}
