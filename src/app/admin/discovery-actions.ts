"use server";

import { getDb } from "@/db/client";
import {
  automationSettings,
  editorialProfiles,
  generationRequests,
  newsSources,
  storyIdeas,
} from "@/db/schema";
import { requireEditorForAction } from "@/lib/admin";
import { acceptableFeedUrl, discoverNews } from "@/lib/rss-discovery";
import type { D1Database } from "@cloudflare/workers-types";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function val(form: FormData, name: string, limit: number) {
  return String(form.get(name) ?? "")
    .trim()
    .slice(0, limit);
}
export async function addNewsSource(form: FormData) {
  await requireEditorForAction();
  const name = val(form, "name", 120);
  const feedUrl = val(form, "feedUrl", 1500);
  const pollIntervalMinutes = Number(form.get("pollIntervalMinutes"));
  if (
    !name ||
    !acceptableFeedUrl(feedUrl) ||
    !Number.isInteger(pollIntervalMinutes) ||
    pollIntervalMinutes < 15 ||
    pollIntervalMinutes > 10080
  ) {
    throw new Error(
      "Enter a name, a public HTTPS RSS/Atom URL, and a valid interval (15–10080 minutes)",
    );
  }
  const db = await getDb();
  await db.insert(newsSources).values({
    id: crypto.randomUUID(),
    name,
    feedUrl,
    method: "rss",
    pollIntervalMinutes,
    isEnabled: true,
  });
  revalidatePath("/admin/sources");
  redirect("/admin/sources");
}
export async function updateNewsSourceInterval(form: FormData) {
  await requireEditorForAction();
  const id = val(form, "id", 64);
  const minutes = Number(form.get("pollIntervalMinutes"));
  if (!Number.isInteger(minutes) || minutes < 15 || minutes > 10080)
    throw new Error("Interval must be 15–10080 minutes");
  const db = await getDb();
  await db
    .update(newsSources)
    .set({ pollIntervalMinutes: minutes, updatedAt: new Date().toISOString() })
    .where(eq(newsSources.id, id));
  revalidatePath("/admin/sources");
  redirect("/admin/sources");
}
export async function toggleNewsSource(form: FormData) {
  await requireEditorForAction();
  const db = await getDb();
  const id = val(form, "id", 64);
  const [source] = await db
    .select()
    .from(newsSources)
    .where(eq(newsSources.id, id))
    .limit(1);
  if (!source) throw new Error("Source not found");
  await db
    .update(newsSources)
    .set({ isEnabled: !source.isEnabled, updatedAt: new Date().toISOString() })
    .where(eq(newsSources.id, id));
  revalidatePath("/admin/sources");
  redirect("/admin/sources");
}
export async function checkNewsFeeds() {
  await requireEditorForAction();
  const { env } = await getCloudflareContext({ async: true });
  const binding = (env as unknown as { DB: D1Database }).DB;
  const result = await discoverNews(binding, { force: true });
  revalidatePath("/admin/ideas");
  revalidatePath("/admin/sources");
  redirect(
    `/admin/sources?checked=${result.checked}&found=${result.discovered}&errors=${result.errors.length}`,
  );
}
export async function addDemoIdeas() {
  await requireEditorForAction();
  const db = await getDb();
  const demos = [
    [
      "DEMO IDEA: Labor organizing and workplace protections",
      "Placeholder pitch about labor organizing; no research performed.",
      "Labor",
    ],
    [
      "DEMO IDEA: Housing affordability and working families",
      "Placeholder pitch about rent and housing costs; no research performed.",
      "Economy",
    ],
    [
      "DEMO IDEA: Entertainment culture-war controversies",
      "Placeholder pitch about political commentary on entertainment; no research performed.",
      "Culture",
    ],
  ];
  for (const [headline, summary, section] of demos) {
    await db.insert(storyIdeas).values({
      id: crypto.randomUUID(),
      headline,
      summary,
      section,
      status: "new",
    });
  }
  revalidatePath("/admin/ideas");
  redirect("/admin/ideas");
}
export async function turnIdeaIntoBrief(form: FormData) {
  const editor = await requireEditorForAction();
  const id = val(form, "id", 64);
  const db = await getDb();
  const [idea] = await db
    .select()
    .from(storyIdeas)
    .where(eq(storyIdeas.id, id))
    .limit(1);
  if (!idea || !["new", "selected"].includes(idea.status))
    throw new Error("Idea is not available");
  await db.insert(generationRequests).values({
    id: crypto.randomUUID(),
    origin: "story_idea",
    ideaId: idea.id,
    requestedById: editor.id,
    topicPrompt: idea.headline,
    requestedFraming: idea.suggestedAngle || null,
    additionalInstructions: `Review source context; original idea summary: ${idea.summary.slice(0, 1000)}${idea.sourceUrl ? ` Source: ${idea.sourceUrl}` : ""}`,
    status: "queued",
  });
  await db
    .update(storyIdeas)
    .set({ status: "selected", updatedAt: new Date().toISOString() })
    .where(eq(storyIdeas.id, id));
  revalidatePath("/admin/inbox");
  revalidatePath("/admin/ideas");
  redirect("/admin/inbox");
}
export async function saveDiscoverySettings(form: FormData) {
  const editor = await requireEditorForAction();
  const maxIdeasPerRun = Number(form.get("maxIdeasPerRun"));
  if (
    !Number.isInteger(maxIdeasPerRun) ||
    maxIdeasPerRun < 1 ||
    maxIdeasPerRun > 100
  )
    throw new Error("Maximum ideas must be between 1 and 100");
  const db = await getDb();
  await db
    .insert(automationSettings)
    .values({
      id: crypto.randomUUID(),
      name: "news-discovery",
      isEnabled: form.get("enabled") === "on",
      cronExpression: "*/15 * * * *",
      maxIdeasPerRun,
      maxDraftsPerRun: 0,
      requireHumanReview: true,
      updatedById: editor.id,
    })
    .onConflictDoUpdate({
      target: automationSettings.name,
      set: {
        isEnabled: form.get("enabled") === "on",
        maxIdeasPerRun,
        requireHumanReview: true,
        updatedById: editor.id,
        updatedAt: new Date().toISOString(),
      },
    });
  revalidatePath("/admin/settings");
  redirect("/admin/settings");
}
export async function saveEditorialProfile(form: FormData) {
  await requireEditorForAction();
  const name = val(form, "name", 100) || "Default newsroom style";
  const writingInstructions = val(form, "writingInstructions", 8000);
  if (!writingInstructions) throw new Error("Provide writing instructions");
  const db = await getDb();
  const [profile] = await db
    .select()
    .from(editorialProfiles)
    .where(eq(editorialProfiles.isDefault, true))
    .limit(1);
  if (profile) {
    await db
      .update(editorialProfiles)
      .set({ name, writingInstructions, updatedAt: new Date().toISOString() })
      .where(eq(editorialProfiles.id, profile.id));
  } else {
    await db.insert(editorialProfiles).values({
      id: crypto.randomUUID(),
      name,
      writingInstructions,
      isDefault: true,
    });
  }
  revalidatePath("/admin/settings");
  redirect("/admin/settings");
}
