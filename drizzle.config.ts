import { defineConfig } from "drizzle-kit";

// Generate versioned SQL migrations; Wrangler applies them to local / remote D1.
// No Cloudflare API token is needed for migration generation.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  verbose: true,
  strict: true,
});
