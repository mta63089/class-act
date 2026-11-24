/** Dedicated Cloudflare Cron Worker: runs separately from the Next.js web Worker. */
import type { D1Database } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { automationSettings } from "../db/schema";
import { discoverNews } from "../lib/rss-discovery";

type Env = { DB: D1Database };
export default {
  async scheduled(_controller: unknown, env: Env, ctx: { waitUntil(promise: Promise<unknown>): void }) {
    ctx.waitUntil((async () => {
      const db = drizzle(env.DB);
      const [settings] = await db.select().from(automationSettings)
        .where(eq(automationSettings.name, "news-discovery")).limit(1);
      if (!settings?.isEnabled || !settings.requireHumanReview) return;
      const result = await discoverNews(env.DB);
      console.log("Discovery completed", { checked: result.checked, discovered: result.discovered, errorCount: result.errors.length });
    })());
  },
};
