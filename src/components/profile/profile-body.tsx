import {
  buildTimelineSeries,
  computeStreaks,
  mergeActivity,
  summarizeContests,
} from "@/lib/analytics";
import { CONTEST_PLATFORMS, PLATFORM_META } from "@/lib/platforms";
import { aggregateTags, type HandleView, parseStats, platformProfileUrl } from "@/lib/profile";

import { ActivityHeatmap } from "./activity-heatmap";
import { AnalyticsTiles } from "./analytics-tiles";
import { HandleStats } from "./handle-stats";
import { PlatformChip } from "./platform-chip";
import { ProfileTotals } from "./profile-totals";
import { RatingTimeline } from "./rating-timeline";
import { TopicChart } from "./topic-chart";

/** "Codeforces, LeetCode & AtCoder" from a list of platform labels. */
function joinLabels(labels: string[]): string {
  return labels.length <= 1
    ? (labels[0] ?? "")
    : `${labels.slice(0, -1).join(", ")} & ${labels[labels.length - 1]}`;
}

/** The verified-profiles stats display, shared by /profile and /u/<username>. */
export function ProfileBody({ handles }: { handles: HandleView[] }) {
  const tags = aggregateTags(handles);

  // Analytics derivations — all from the cached stats JSON, so this stays a
  // server component and the public page gets the same section for free.
  const activity = mergeActivity(handles);
  const streaks = activity.days.length > 0 ? computeStreaks(activity.days) : null;
  const summary = summarizeContests(handles);
  const timeline = buildTimelineSeries(handles);
  const hasHistory = handles.some((h) => (parseStats(h.stats).ratingHistory?.length ?? 0) > 0);
  const activityLabel = joinLabels(activity.sources.map((p) => PLATFORM_META[p].label));

  // Which platforms actually contributed tags (so the caption is honest and
  // auto-updates if a future platform starts exposing problem topics).
  const tagSourceLabel = joinLabels(
    handles
      .filter((h) => (parseStats(h.stats).tags?.length ?? 0) > 0)
      .map((h) => PLATFORM_META[h.platform].label),
  );

  return (
    <div className="space-y-5">
      <ProfileTotals handles={handles} />

      {streaks || hasHistory ? <AnalyticsTiles streaks={streaks} summary={summary} /> : null}

      {timeline.length > 0 ? (
        <div className="rounded-[14px] border border-cp-line bg-cp-surface p-4 sm:p-5">
          <div className="mb-1 font-mono text-[11px] uppercase tracking-wide text-cp-faint">
            Rating timeline
          </div>
          <p className="mb-3 text-[12px] text-cp-dim">
            Contest rating after each rated round, per platform.
          </p>
          <RatingTimeline series={timeline} />
        </div>
      ) : null}

      {activity.days.length > 0 ? (
        <div className="rounded-[14px] border border-cp-line bg-cp-surface p-4 sm:p-5">
          <div className="mb-1 font-mono text-[11px] uppercase tracking-wide text-cp-faint">
            Submission activity
          </div>
          <p className="mb-3 text-[12px] text-cp-dim">
            Submissions per day (UTC) over the last year across {activityLabel}.
          </p>
          <ActivityHeatmap days={activity.days} />
        </div>
      ) : null}

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
