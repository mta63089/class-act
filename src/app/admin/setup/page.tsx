import { redirect } from "next/navigation";
import Link from "next/link";
import { getDb } from "@/db/client";
import { cmsUsers } from "@/db/schema";
import { SetupForm } from "./setup-form";

export const dynamic = "force-dynamic";

export default async function OwnerSetupPage() {
  const db = await getDb();
  if ((await db.select({ id: cmsUsers.id }).from(cmsUsers).limit(1)).length) redirect("/admin/login");
  return (
    <section className="mx-auto my-12 max-w-lg px-5">
      <div className="border-[3px] border-ink bg-card p-7 shadow-[6px_6px_0_#1b1818]">
        <p className="text-xs font-black tracking-widest uppercase">Private administration</p>
        <h1 className="mt-2 font-display text-5xl font-black uppercase">Owner setup</h1>
        <p className="mt-3 text-sm">Create the first editor account. This page closes automatically once an owner exists. Enter the <code>CMS_SETUP_TOKEN</code> from your local environment.</p>
        <SetupForm />
        <Link href="/admin/login" className="mt-6 inline-block text-sm font-bold underline">Already have an account? Sign in</Link>
      </div>
    </section>
  );
}
