import type { Metadata } from "next";

import { auth } from "@/auth";
import { ProfileManager } from "@/components/profile/profile-manager";
import { SignInPrompt } from "@/components/profile/sign-in-prompt";
import { AccentPicker } from "@/components/theme/accent-picker";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export const metadata: Metadata = {
  title: "Settings — NextContest",
  description: "Connect and verify your competitive-programming handles and choose your public profile username.",
};

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <SignInPrompt
        redirectTo="/settings"
        title="Build your CP profile"
        subtitle="Sign in to connect your handles and choose a public profile username."
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-[840px] px-4 py-10 sm:px-[22px]">
      <header className="mb-6">
        <h1 className="font-display text-[clamp(1.7rem,3.4vw,2.4rem)] font-bold tracking-[-0.02em]">
          Settings
        </h1>
        <p className="mt-1 text-[15px] text-cp-dim">
          Connect &amp; verify your handles and choose your public username. Your verified profiles
          appear on your{" "}
          <a href="/profile" className="text-cp-accent hover:underline">
            Profile
          </a>
          .
        </p>
      </header>

      <ProfileManager />

      <section className="mt-6 rounded-[14px] border border-cp-line bg-cp-surface p-4 sm:p-5">
        <h2 className="font-display text-[16px] font-bold">Appearance</h2>
        <div className="mt-3 flex items-center justify-between gap-4">
          <div>
            <div className="text-[14px] font-medium text-cp-text">Theme</div>
            <div className="text-[12px] text-cp-dim">Switch between dark and light.</div>
          </div>
          <ThemeToggle />
        </div>
        <div className="mt-4 flex items-center justify-between gap-4 border-t border-cp-line pt-4">
          <div>
            <div className="text-[14px] font-medium text-cp-text">Accent</div>
            <div className="text-[12px] text-cp-dim">Pick your highlight color.</div>
          </div>
          <AccentPicker />
        </div>
      </section>
    </main>
  );
}
