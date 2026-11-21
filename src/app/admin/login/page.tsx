"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

const field = "w-full border-2 border-ink bg-white p-3 text-ink outline-offset-2";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await authClient.signIn.email({
        email: String(data.get("email") ?? ""),
        password: String(data.get("password") ?? ""),
      });
      if (response.error) {
        setError("Sign-in failed. Check your credentials.");
      } else {
        window.location.assign("/admin/inbox");
      }
    } catch {
      setError("Unable to sign in right now.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mx-auto my-12 max-w-lg px-5">
      <div className="border-[3px] border-ink bg-card p-7 shadow-[6px_6px_0_#1b1818]">
        <p className="text-xs font-black tracking-widest uppercase">The Class Act Daily · Private</p>
        <h1 className="mt-2 font-display text-5xl font-black uppercase">Editor sign in</h1>
        <p className="mt-2 text-sm">Your editorial inbox, drafts, and story ideas.</p>
        <form onSubmit={signIn} className="mt-6 flex flex-col gap-4">
          <label className="grid gap-1 text-sm font-bold">Email<input name="email" type="email" autoComplete="email" required className={field} /></label>
          <label className="grid gap-1 text-sm font-bold">Password<input name="password" type="password" autoComplete="current-password" required className={field} /></label>
          {error && <p role="alert" className="border-l-4 border-pop-red px-3 text-sm font-semibold">{error}</p>}
          <button disabled={pending} className="border-2 border-ink bg-sun px-5 py-3 text-sm font-black shadow-[3px_3px_0_#1b1818] disabled:opacity-50">{pending ? "Signing in…" : "Sign in"}</button>
        </form>
        <Link href="/" className="mt-6 inline-block text-sm font-bold underline">Back to the website</Link>
      </div>
    </section>
  );
}
