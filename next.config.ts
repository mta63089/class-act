import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;

// Make local Wrangler D1 available to getCloudflareContext() in `next dev`.
initOpenNextCloudflareForDev();
