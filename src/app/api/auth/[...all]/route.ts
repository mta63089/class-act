import { createAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Public API always rejects new sign-ups. Only /admin/setup can provision
// the initial owner account using a server-only setup token.
export async function GET(request: Request) {
  return (await createAuth()).handler(request);
}

export async function POST(request: Request) {
  return (await createAuth()).handler(request);
}
