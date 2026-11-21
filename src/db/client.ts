import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { D1Database } from "@cloudflare/workers-types";
import { drizzle } from "drizzle-orm/d1";
import { cache } from "react";
import * as editorialSchema from "./schema";
import * as authSchema from "./auth-schema";

// Never cache the D1 handle at module scope in a Worker.
export const getDb = cache(async () => {
  const { env } = await getCloudflareContext({ async: true });
  const binding = (env as unknown as { DB?: D1Database }).DB;
  if (!binding) {
    throw new Error("D1 binding DB is missing. Check wrangler.jsonc and next.config.ts.");
  }
  return drizzle(binding, { schema: { ...editorialSchema, ...authSchema } });
});

export type Database = Awaited<ReturnType<typeof getDb>>;
