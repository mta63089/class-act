"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { cmsUsers } from "@/db/schema";
import { createAuth } from "@/lib/auth";

export type SetupState = { error: string };

export async function setupOwner(_previous: SetupState, data: FormData): Promise<SetupState> {
  const setupToken = process.env.CMS_SETUP_TOKEN;
  const submittedToken = String(data.get("setupToken") ?? "");
  if (!setupToken || setupToken.length < 32 || submittedToken !== setupToken) {
    return { error: "Invalid setup token." };
  }

  const name = String(data.get("name") ?? "").trim();
  const email = String(data.get("email") ?? "").trim().toLowerCase();
  const password = String(data.get("password") ?? "");
  if (name.length < 2 || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12) {
    return { error: "Enter a name, valid email address, and password of at least 12 characters." };
  }

  const db = await getDb();
  if ((await db.select({ id: cmsUsers.id }).from(cmsUsers).limit(1)).length) {
    return { error: "The owner account is already configured. Sign in instead." };
  }

  try {
    const auth = await createAuth(true);
    const result = await auth.api.signUpEmail({
      body: { name, email, password },
    });
    if (!result?.user?.id) return { error: "Account setup was not completed." };
    await db.insert(cmsUsers).values({
      id: result.user.id,
      email,
      displayName: name,
      role: "admin",
    });
  } catch (error) {
    console.error("Owner setup failed", error);
    return { error: "Account creation failed. Check the development server log." };
  }

  redirect("/admin/login?created=1");
}
