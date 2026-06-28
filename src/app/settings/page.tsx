import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { SettingsShell } from "@/components/settings/settings-shell";

export const metadata: Metadata = {
  title: "Settings — NextContest",
  description: "Connect and verify your competitive-programming handles and choose your public profile username.",
};

export default async function SettingsPage() {
  const session = await auth();

  // Auth-gated: a logged-out visitor shouldn't be able to land here at all.
  if (!session?.user) notFound();

  return (
    <main className="mx-auto w-full max-w-[980px] px-4 py-10 sm:px-[22px]">
      <PageHeader
        title="Settings"
        subtitle="Manage your public profile, connect your coding handles, and set the look of the app."
        action={
          <Link
            href="/profile"
            className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-cp-line bg-cp-surface px-3.5 text-[13px] font-semibold text-cp-dim transition-colors hover:text-cp-text"
          >
            View your profile
            <span aria-hidden>→</span>
          </Link>
        }
      />

      <SettingsShell />
    </main>
  );
}
