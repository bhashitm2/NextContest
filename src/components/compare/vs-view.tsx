import { Crown, Minus } from "lucide-react";

import { avatarSrc } from "@/lib/avatar";
import type { CompareCategory, CompareResult, TopicLead, Winner } from "@/lib/compare";
import { platformColor } from "@/lib/platforms";

// Fixed competitor colors so "you" vs "them" stay legible in any accent theme.
const A_COLOR = "var(--cp-accent)";
const B_COLOR = "#f59e0b";

function Avatar({
  image,
  label,
  ring,
  size = 64,
}: {
  image: string | null;
  label: string;
  ring: string;
  size?: number;
}) {
  const initial = label.charAt(0).toUpperCase();
  const src = avatarSrc(image);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      style={{ width: size, height: size, boxShadow: `0 0 0 3px ${ring}` }}
      className="rounded-full border border-cp-line object-cover"
    />
  ) : (
    <span
      style={{ width: size, height: size, background: ring, boxShadow: `0 0 0 3px ${ring}` }}
      className="grid place-items-center rounded-full text-2xl font-bold text-cp-accent-ink"
    >
      {initial}
    </span>
  );
}

function fmt(value: number, format: CompareCategory["format"]): string {
  if (format === "rating") return value > 0 ? String(value) : "—";
  return value.toLocaleString();
}

function WinnerMark({ winner, side }: { winner: Winner; side: "a" | "b" }) {
  if (winner === side) return <Crown className="size-3.5 text-cp-accent" />;
  return null;
}

function CategoryCard({ c }: { c: CompareCategory }) {
  const accent = c.platform ? platformColor(c.platform) : "var(--cp-accent)";
  return (
    <div className="rounded-[12px] border border-cp-line bg-cp-surface p-3.5">
      <div className="mb-2 text-[12px] font-semibold" style={{ color: accent }}>
        {c.label}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className={`flex items-center gap-1.5 ${c.winner === "a" ? "" : "opacity-55"}`}>
          <span className="font-display text-[20px] font-bold leading-none">
            {fmt(c.aValue, c.format)}
          </span>
          <WinnerMark winner={c.winner} side="a" />
        </div>
        <span className="font-mono text-[11px] text-cp-faint">vs</span>
        <div className={`flex items-center gap-1.5 ${c.winner === "b" ? "" : "opacity-55"}`}>
          <WinnerMark winner={c.winner} side="b" />
          <span className="font-display text-[20px] font-bold leading-none">
            {fmt(c.bValue, c.format)}
          </span>
        </div>
      </div>
    </div>
  );
}

function TopicRow({ lead, max }: { lead: TopicLead; max: number }) {
  const aPct = (lead.aCount / max) * 100;
  const bPct = (lead.bCount / max) * 100;
  return (
    <div className="flex items-center gap-2">
      <span className="w-8 shrink-0 text-right font-mono text-[11px] text-cp-dim">
        {lead.aCount}
      </span>
      <div className="flex flex-1 justify-end">
        <div
          className="h-3.5 rounded-l-[4px]"
          style={{ width: `${aPct}%`, background: A_COLOR, opacity: lead.winner === "b" ? 0.45 : 1 }}
        />
      </div>
      <span
        className="w-24 shrink-0 truncate text-center text-[11px] text-cp-dim"
        title={lead.tag}
      >
        {lead.tag}
      </span>
      <div className="flex flex-1 justify-start">
        <div
          className="h-3.5 rounded-r-[4px]"
          style={{ width: `${bPct}%`, background: B_COLOR, opacity: lead.winner === "a" ? 0.45 : 1 }}
        />
      </div>
      <span className="w-8 shrink-0 font-mono text-[11px] text-cp-dim">{lead.bCount}</span>
    </div>
  );
}

export function VsView({ result }: { result: CompareResult }) {
  const { a, b, categories, topics, overall } = result;
  const aLabel = a.name ?? a.username ?? "You";
  const bLabel = b.name ?? b.username ?? "Friend";
  const topTopics = topics.leads.slice(0, 12);
  const topicMax = Math.max(...topTopics.flatMap((t) => [t.aCount, t.bCount]), 1);

  const winnerLabel =
    overall.winner === "a" ? aLabel : overall.winner === "b" ? bLabel : null;

  return (
    <div className="space-y-5">
      {/* VS hero */}
      <div className="overflow-hidden rounded-[18px] border border-cp-line bg-cp-surface">
        <div className="flex items-center justify-between gap-3 p-5 sm:p-7">
          <div className="flex min-w-0 flex-col items-center gap-2 text-center">
            <Avatar image={a.image} label={aLabel} ring={A_COLOR} />
            <div className="min-w-0">
              <div className="truncate text-[14px] font-bold text-cp-text">{aLabel}</div>
              {a.username ? (
                <div className="truncate font-mono text-[11px] text-cp-dim">@{a.username}</div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col items-center gap-1">
            <span className="font-display text-[clamp(1.8rem,5vw,2.6rem)] font-black tracking-tight text-cp-faint">
              VS
            </span>
            <span className="font-mono text-[13px] font-bold text-cp-text">
              {overall.aScore} – {overall.bScore}
            </span>
          </div>

          <div className="flex min-w-0 flex-col items-center gap-2 text-center">
            <Avatar image={b.image} label={bLabel} ring={B_COLOR} />
            <div className="min-w-0">
              <div className="truncate text-[14px] font-bold text-cp-text">{bLabel}</div>
              {b.username ? (
                <div className="truncate font-mono text-[11px] text-cp-dim">@{b.username}</div>
              ) : null}
            </div>
          </div>
        </div>

        <div
          className="flex items-center justify-center gap-2 border-t border-cp-line px-5 py-3 text-[14px] font-semibold"
          style={{ background: "color-mix(in srgb, var(--cp-accent) 9%, transparent)" }}
        >
          {winnerLabel ? (
            <>
              <Crown className="size-4 text-cp-accent" />
              <span className="text-cp-text">{winnerLabel} wins!</span>
            </>
          ) : (
            <>
              <Minus className="size-4 text-cp-dim" />
              <span className="text-cp-dim">Dead heat — it&apos;s a tie!</span>
            </>
          )}
        </div>
      </div>

      {/* Category badges */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {categories.map((c) => (
          <CategoryCard key={c.key} c={c} />
        ))}
      </div>

      {/* Topic diverging chart */}
      {topTopics.length > 0 ? (
        <div className="rounded-[14px] border border-cp-line bg-cp-surface p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-mono text-[11px] uppercase tracking-wide text-cp-faint">
              Topics head-to-head
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1.5 text-cp-dim">
                <span className="size-2.5 rounded-full" style={{ background: A_COLOR }} />
                {aLabel}
              </span>
              <span className="flex items-center gap-1.5 text-cp-dim">
                <span className="size-2.5 rounded-full" style={{ background: B_COLOR }} />
                {bLabel}
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            {topTopics.map((lead) => (
              <TopicRow key={lead.tag} lead={lead} max={topicMax} />
            ))}
          </div>
          <p className="mt-3 text-[12px] text-cp-dim">
            {topics.winner === "a"
              ? `${aLabel} leads on ${topics.aWon} of ${topics.leads.length} topics.`
              : topics.winner === "b"
                ? `${bLabel} leads on ${topics.bWon} of ${topics.leads.length} topics.`
                : "Topics are evenly split."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
