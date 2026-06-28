"use client";

import { Link2, Palette, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { AddHandleForm } from "@/components/profile/add-handle-form";
import { HandleCard } from "@/components/profile/handle-card";
import { UsernameForm } from "@/components/profile/username-form";
import { AccentPicker } from "@/components/theme/accent-picker";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import type { Platform } from "@/generated/prisma/client";
import { api } from "@/trpc/react";

const SECTIONS = [
  { id: "profile", label: "Profile", hint: "Your public username", icon: UserRound },
  { id: "links", label: "Profile Links", hint: "Connect coding handles", icon: Link2 },
  { id: "appearance", label: "Appearance", hint: "Theme & accent color", icon: Palette },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

/**
 * Settings split across a sidebar: Profile (public username), Profile Links
 * (connect & verify coding handles) and Appearance (theme + accent). The data
 * queries live here so switching sections doesn't refetch.
 */
export function SettingsShell() {
  const [active, setActive] = useState<SectionId>("profile");
  const list = api.handle.list.useQuery();
  const username = api.handle.myUsername.useQuery();

  const handles = list.data ?? [];
  const connected = new Set<Platform>(handles.map((h) => h.platform));

  return (
    <div className="flex flex-col gap-6 md:flex-row md:gap-8">
      <nav
        aria-label="Settings sections"
        className="flex gap-2 overflow-x-auto pb-1 md:w-56 md:shrink-0 md:flex-col md:overflow-visible md:pb-0"
      >
        {SECTIONS.map((s) => {
          const isActive = active === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              aria-current={isActive ? "true" : undefined}
              className={`flex shrink-0 items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-left transition-colors md:w-full ${
                isActive
                  ? "border-cp-line-strong bg-cp-surface text-cp-text"
                  : "border-transparent text-cp-dim hover:bg-cp-surface hover:text-cp-text"
              }`}
            >
              <s.icon className={`size-[18px] shrink-0 ${isActive ? "text-cp-accent" : ""}`} />
              <span className="min-w-0">
                <span className="block whitespace-nowrap text-[13.5px] font-semibold">
                  {s.label}
                </span>
                <span className="hidden whitespace-nowrap text-[11.5px] font-normal text-cp-dim md:block">
                  {s.hint}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="min-w-0 flex-1">
        {active === "profile" ? (
          <SettingsSection
            title="Profile"
            description="Choose the public username your profile lives at — people find you on NextContest by this."
          >
            {username.isLoading ? (
              <Skeleton className="h-32 w-full rounded-[14px]" />
            ) : (
              <UsernameForm initialUsername={username.data?.username ?? null} />
            )}
          </SettingsSection>
        ) : null}

        {active === "links" ? (
          <SettingsSection
            title="Profile Links"
            description="Connect & verify your coding handles. Verified handles power your stats, ratings and head-to-head comparisons."
          >
            <div className="space-y-5">
              <AddHandleForm connected={connected} />

              {list.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-28 w-full rounded-[14px]" />
                  <Skeleton className="h-28 w-full rounded-[14px]" />
                </div>
              ) : handles.length === 0 ? (
                <div className="rounded-[14px] border border-dashed border-cp-line bg-cp-surface p-8 text-center text-cp-dim">
                  No handles connected yet. Add one above to start building your profile.
                </div>
              ) : (
                <div className="space-y-3">
                  {handles.map((h) => (
                    <HandleCard key={h.platform} handle={h} />
                  ))}
                </div>
              )}
            </div>
          </SettingsSection>
        ) : null}

        {active === "appearance" ? (
          <SettingsSection title="Appearance" description="Personalize how NextContest looks.">
            <div className="rounded-[14px] border border-cp-line bg-cp-surface p-4 sm:p-5">
              <div className="flex items-center justify-between gap-4">
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
            </div>
          </SettingsSection>
        ) : null}
      </div>
    </div>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="animate-tab-in">
      <div className="mb-4">
        <h2 className="font-display text-[18px] font-bold text-cp-text">{title}</h2>
        <p className="mt-0.5 text-[13.5px] text-cp-dim">{description}</p>
      </div>
      {children}
    </section>
  );
}
