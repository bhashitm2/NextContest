import { CONTEST_PLATFORMS, PLATFORM_META } from "@/lib/platforms";
import { aggregateTags, type HandleView, parseStats, platformProfileUrl } from "@/lib/profile";

import { HandleStats } from "./handle-stats";
import { PlatformChip } from "./platform-chip";
import { ProfileTotals } from "./profile-totals";
import { TopicChart } from "./topic-chart";

/** The verified-profiles stats display, shared by /profile and /u/<username>. */
export function ProfileBody({ handles }: { handles: HandleView[] }) {
  const tags = aggregateTags(handles);

  // Which platforms actually contributed tags (so the caption is honest and
  // auto-updates if a future platform starts exposing problem topics).
  const tagSources = handles
    .filter((h) => (parseStats(h.stats).tags?.length ?? 0) > 0)
    .map((h) => PLATFORM_META[h.platform].label);
  const tagSourceLabel =
    tagSources.length <= 1
      ? (tagSources[0] ?? "")
      : `${tagSources.slice(0, -1).join(", ")} & ${tagSources[tagSources.length - 1]}`;

  return (
    <div className="space-y-5">
      <ProfileTotals handles={handles} />

      {tags.length > 0 ? (
        <div className="rounded-[14px] border border-cp-line bg-cp-surface p-4 sm:p-5">
          <div className="mb-1 font-mono text-[11px] uppercase tracking-wide text-cp-faint">
            Topics solved
          </div>
          <p className="mb-3 text-[12px] text-cp-dim">
            Problems by tag across {tagSourceLabel}.
          </p>
          <TopicChart data={tags} />
        </div>
      ) : null}

      {/* Detailed per-platform cards only for the rich-stats (contest) platforms.
          Profile-only platforms (GeeksforGeeks/Code360/HackerRank) have nothing
          beyond a solved count, so they live only in the Total-solved strip above. */}
      {handles
        .filter((h) => CONTEST_PLATFORMS.includes(h.platform))
        .map((h) => (
        <section
          key={h.platform}
          className="rounded-[14px] border border-cp-line bg-cp-surface p-4 sm:p-5"
        >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <PlatformChip platform={h.platform} />
            <a
              href={platformProfileUrl(h.platform, h.handle)}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[14px] font-semibold text-cp-text hover:text-cp-accent"
            >
              {h.handle}
            </a>
          </div>
          <HandleStats handle={h} />
        </section>
      ))}
    </div>
  );
}
