"use server";

import { getDb } from "@/db/client";
import { statusAfterEdit } from "@/db/editorial-rules";
import {
  articles,
  articleVersions,
  generationRequests,
  type ArticleBlock,
} from "@/db/schema";
import { requireEditorForAction } from "@/lib/admin";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const sections = ["Politics", "Labor", "Economy", "Culture"] as const;

function requiredText(form: FormData, name: string, max = 10000): string {
  const value = String(form.get(name) ?? "").trim();
  if (!value || value.length > max) throw new Error(`Invalid ${name}`);
  return value;
}
function paragraphs(text: string): ArticleBlock[] {
  return text
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => ({ type: "paragraph" as const, text: item }));
}
function sectionValue(form: FormData) {
  const section = requiredText(form, "section", 40);
  if (!(sections as readonly string[]).includes(section))
    throw new Error("Invalid article section");
  return section;
}

export async function queueManualGeneration(form: FormData) {
  const editor = await requireEditorForAction();
  const topic = requiredText(form, "topic", 3000);
  const framing = String(form.get("framing") ?? "")
    .trim()
    .slice(0, 3000);
  const instructions = String(form.get("instructions") ?? "")
    .trim()
    .slice(0, 5000);
  const db = await getDb();
  await db.insert(generationRequests).values({
    id: crypto.randomUUID(),
    origin: "manual",
    requestedById: editor.id,
    topicPrompt: topic,
    requestedFraming: framing || null,
    additionalInstructions: instructions || null,
    status: "queued",
  });
  revalidatePath("/admin/inbox");
  redirect("/admin/inbox");
}

export async function createManualArticle(form: FormData) {
  const editor = await requireEditorForAction();
  const title = requiredText(form, "title", 200);
  const dek = requiredText(form, "dek", 600);
  const section = sectionValue(form);
  const content = requiredText(form, "body", 150000);
  const body = paragraphs(content);
  if (!body.length) throw new Error("An article needs at least one paragraph");
  const id = crypto.randomUUID();
  const slugBase = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);
  const slug = `${slugBase || "article"}-${id.slice(0, 8)}`;
  const db = await getDb();
  await db.insert(articles).values({
    id,
    slug,
    title,
    dek,
    section,
    body,
    status: "draft",
    createdById: editor.id,
  });
  await db.insert(articleVersions).values({
    id: crypto.randomUUID(),
    articleId: id,
    version: 1,
    title,
    dek,
    body,
    origin: "manual",
    createdById: editor.id,
    changeSummary: "Initial manual draft",
  });
  revalidatePath("/admin/inbox");
  redirect(`/admin/articles/${id}`);
}

export async function saveManualRevision(form: FormData) {
  const editor = await requireEditorForAction();
  const id = requiredText(form, "id", 64);
  const title = requiredText(form, "title", 200);
  const dek = requiredText(form, "dek", 600);
  const content = requiredText(form, "body", 150000);
  const body = paragraphs(content);
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);
  if (
    !existing ||
    existing.status === "published" ||
    existing.status === "archived"
  )
    throw new Error("This article is not editable in the draft editor");
  if (existing.body.some((block) => block.type !== "paragraph"))
    throw new Error(
      "This article requires the structured editor to preserve quotes and headings",
    );
  const version = existing.currentVersion + 1;
  const [updated] = await db
    .update(articles)
    .set({
      title,
      dek,
      body,
      currentVersion: version,
      status: statusAfterEdit(),
      approvedVersion: null,
      reviewedById: null,
      reviewedAt: null,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(articles.id, id),
        eq(articles.currentVersion, existing.currentVersion),
      ),
    )
    .returning({ id: articles.id });
  if (!updated)
    throw new Error(
      "The article changed in another session. Refresh before saving.",
    );
  await db.insert(articleVersions).values({
    id: crypto.randomUUID(),
    articleId: id,
    version,
    title,
    dek,
    body,
    origin: "editor",
    createdById: editor.id,
    changeSummary: "Manual revision",
  });
  revalidatePath("/admin/inbox");
  revalidatePath(`/admin/articles/${id}`);
  redirect(`/admin/articles/${id}`);
}
