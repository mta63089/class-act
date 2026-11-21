"use client";

import { authClient } from "@/lib/auth-client";

export function AdminSignOut() {
  return (
    <button type="button" className="text-sm font-bold underline underline-offset-4" onClick={async () => {
      await authClient.signOut();
      window.location.assign("/admin/login");
    }}>Sign out</button>
  );
}
