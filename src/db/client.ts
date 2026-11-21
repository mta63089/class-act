import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";
import { cache } from "react";
import * as schema from "./schema";

// The D1 binding is request-scoped. Do not create a global connection.
// The async form also works when a route is statically rendered at build time;
// dynamic CMS routes should explicitly opt out of static prerendering.
export const getDb = cache(async () => {
  const { env } = await getCloudflareContext({ async: true });
  const binding = (env as unknown as { DB?: D1Database }).DB;
  if (!binding) {
    throw new Error("Cloudflare D1 binding DB is missing. Check wrangler.jsonc and local Cloudflare configuration.");
  }
  return drizzle(binding, { schema });
});

export type Database = Awaited<ReturnType<typeof getDb>>;
