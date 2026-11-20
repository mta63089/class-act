import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SITE_DESCRIPTION, SITE_NAME, siteOrigin } from "@/lib/site";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: { default: "The Class Act | Politics, Labor & Culture", template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
    title: "The Class Act | Politics, Labor & Culture",
    description: SITE_DESCRIPTION,
    images: ["/assets/hero.webp"],
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/assets/icon.svg" },
  alternates: { canonical: "/", types: { "application/rss+xml": "/feed.xml" } },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
