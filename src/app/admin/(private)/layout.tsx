import { AdminSignOut } from "@/components/admin-sign-out";
import { requireEditor } from "@/lib/admin";
import Link from "next/link";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

const nav = [
  ["Review inbox", "/admin/inbox"],
  ["Story ideas", "/admin/ideas"],
  ["Request article", "/admin/new"],
  ["Write manually", "/admin/articles/new"],
] as const;

export default async function PrivateAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const editor = await requireEditor();
  return (
    <div className='mx-auto max-w-[1300px] px-4 py-8 sm:px-7'>
      <div className='mb-6 flex flex-wrap items-center justify-between gap-3 border-b-[3px] border-ink pb-4'>
        <div>
          <p className='text-xs font-extrabold tracking-[.16em] uppercase'>
            The Class Act Daily
          </p>
          <h1 className='font-display text-5xl font-black uppercase'>
            Newsroom
          </h1>
        </div>
        <div className='flex items-center gap-5'>
          <span className='text-sm font-semibold'>{editor.displayName}</span>
          <AdminSignOut />
        </div>
      </div>
      <nav aria-label='Newsroom' className='mb-8 flex flex-wrap gap-2'>
        {nav.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className='border-2 border-ink bg-card px-3 py-2 text-[13px] font-extrabold no-underline shadow-[2px_2px_0_#1b1818] hover:bg-lilac'
          >
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
