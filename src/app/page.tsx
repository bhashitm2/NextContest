import { ArrowRight, Bell, CalendarDays, Layers } from "lucide-react";
import Link from "next/link";

import { LiveBoard } from "@/components/landing/live-board";
import { ContestStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { ACTIVE_PLATFORMS, PLATFORM_META, platformColor } from "@/lib/platforms";

const FEATURES = [
  {
    icon: Bell,
    title: "Never miss a contest",
    body: "Email reminders 24 hours and 1 hour before every contest you bookmark.",
  },
  {
    icon: CalendarDays,
    title: "One click to your calendar",
    body: "Add any contest to Google Calendar or download an .ics file instantly.",
  },
  {
    icon: Layers,
    title: "Every platform, one feed",
    body: "Codeforces, LeetCode, AtCoder and CodeChef — aggregated and always fresh.",
  },
];

export default async function Home() {
  const upcoming = await prisma.contest.findMany({
    where: { status: ContestStatus.UPCOMING, startTime: { gte: new Date() } },
    orderBy: { startTime: "asc" },
    take: 6,
  });
  const tracked = await prisma.contest.count({
    where: { startTime: { gte: new Date() } },
  });

  return (
    <main className="mx-auto w-full max-w-[1240px] px-4 sm:px-[22px]">
      {/* hero */}
      <section className="grid grid-cols-1 items-center gap-12 py-[70px] lg:grid-cols-[1.05fr_1fr]">
        <div className="animate-rise">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cp-line bg-cp-surface px-3 py-1.5 text-[12.5px] text-cp-dim">
            <span
              className="size-[7px] rounded-full bg-cp-accent"
              style={{ boxShadow: "0 0 8px var(--cp-accent)", animation: "livePulse 1.8s ease-in-out infinite" }}
            />
            One portal for every coding contest
          </div>
          <h1 className="font-display text-[clamp(2.5rem,5.6vw,4.1rem)] font-bold leading-[1.02] tracking-[-0.03em]">
            Every contest.
            <br />
            Every platform.
            <br />
            <span style={{ color: "var(--cp-accent)", textShadow: "0 0 40px color-mix(in srgb, var(--cp-accent) 45%, transparent)" }}>
              One live feed.
            </span>
          </h1>
          <p className="mt-5 max-w-[30rem] text-[clamp(1rem,1.6vw,1.18rem)] leading-relaxed text-cp-dim">
            Codeforces, LeetCode, AtCoder &amp; CodeChef — aggregated into a single, always-fresh
            feed. Bookmark a round and we&apos;ll remind you before it starts.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/contests"
              className="inline-flex h-[50px] items-center gap-2.5 rounded-[11px] px-6 text-[15px] font-bold text-cp-accent-ink transition-transform hover:-translate-y-0.5"
              style={{ background: "var(--cp-accent)", boxShadow: "0 0 30px color-mix(in srgb, var(--cp-accent) 45%, transparent)" }}
            >
              Browse contests
              <ArrowRight className="size-[17px]" />
            </Link>
            <div className="flex items-center gap-[18px] pl-2 font-mono text-[13px] text-cp-faint">
              <span>
                <span className="font-semibold text-cp-text">{tracked}</span> tracked
              </span>
              <span>
                <span className="font-semibold text-cp-text">4</span> platforms
              </span>
            </div>
          </div>
        </div>

        <div className="animate-rise">
          <LiveBoard contests={upcoming} />
        </div>
      </section>

      {/* platform strip */}
      <section className="flex flex-wrap items-center gap-x-7 gap-y-3.5 pb-14">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-cp-faint">
          Aggregating
        </span>
        {ACTIVE_PLATFORMS.map((p) => (
          <span key={p} className="inline-flex items-center gap-2.5 font-display text-[15px] font-semibold text-cp-dim">
            <span
              className="size-2.5 rounded-full"
              style={{ background: platformColor(p), boxShadow: `0 0 10px color-mix(in srgb, ${platformColor(p)} 60%, transparent)` }}
            />
            {PLATFORM_META[p].label}
          </span>
        ))}
      </section>

      {/* features */}
      <section className="grid grid-cols-1 gap-[18px] pb-[90px] sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-[18px] border border-cp-line bg-cp-surface p-[26px] transition-[transform,border-color] duration-200 hover:-translate-y-[5px] hover:border-cp-line-strong"
          >
            <div
              className="mb-[18px] grid size-[46px] place-items-center rounded-xl text-cp-accent"
              style={{ background: "color-mix(in srgb, var(--cp-accent) 14%, transparent)" }}
            >
              <f.icon className="size-[22px]" />
            </div>
            <h3 className="mb-2 font-display text-lg font-semibold">{f.title}</h3>
            <p className="text-sm leading-relaxed text-cp-dim">{f.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
