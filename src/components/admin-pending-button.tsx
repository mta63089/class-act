"use client";

import { useFormStatus } from "react-dom";

export function AdminPendingButton({ idle, busy, className = "" }: { idle: string; busy: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending}
      className={`border-2 border-ink bg-sun px-5 py-3 text-sm font-black shadow-[3px_3px_0_#1b1818] disabled:cursor-wait disabled:opacity-60 ${className}`}>
      {pending ? busy : idle}
    </button>
  );
}
