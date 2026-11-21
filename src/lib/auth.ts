import * as authSchema from "@/db/auth-schema";
import { getDb } from "@/db/client";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import "server-only";

// Build per request; the D1 binding is request-scoped in Cloudflare Workers.
// Only the server-side, setup-token-protected bootstrap action passes true.
export async function createAuth(allowBootstrapSignup = false) {
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL;
  if (!secret || secret.length < 32 || !baseURL) {
    throw new Error(
      "Set BETTER_AUTH_SECRET (32+ characters) and BETTER_AUTH_URL in .env.local.",
    );
  }

  const db = await getDb();
  return betterAuth({
    secret,
    baseURL,
    database: drizzleAdapter(db, { provider: "sqlite", schema: authSchema }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !allowBootstrapSignup,
      autoSignIn: false,
      minPasswordLength: 12,
    },
    session: { expiresIn: 60 * 60 * 24 * 7 },
  });
}
