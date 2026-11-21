import { getDb } from "@/db/client";
import { cmsUsers } from "@/db/schema";
import { createAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "server-only";

export async function currentEditor() {
  const auth = await createAuth();
  const active = await auth.api.getSession({ headers: await headers() });
  if (!active?.user?.id) return null;
  const db = await getDb();
  const [editor] = await db
    .select()
    .from(cmsUsers)
    .where(eq(cmsUsers.id, active.user.id))
    .limit(1);
  return editor ?? null;
}

export async function requireEditor() {
  const editor = await currentEditor();
  if (!editor) redirect("/admin/login");
  return editor;
}

export async function requireEditorForAction() {
  const editor = await currentEditor();
  if (!editor) throw new Error("Unauthorized editor request");
  return editor;
}
