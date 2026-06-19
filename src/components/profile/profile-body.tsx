import { aggregateTags, type HandleView, platformProfileUrl } from "@/lib/profile";

import { HandleStats } from "./handle-stats";
import { PlatformChip } from "./platform-chip";
import { ProfileTotals } from "./profile-totals";
import { TopicChart } from "./topic-chart";

/** The verified-profiles stats display, shared by /profile and /u/<username>. */
export function ProfileBody({ handles }: { handles: HandleView[] }) {
  const tags = aggregateTags(handles);

  return (
    <div className="space-y-5">
      <ProfileTotals handles={handles} />

      {tags.length > 0 ? (
        <div className="rounded-[14px] border border-cp-line bg-cp-surface p-4 sm:p-5">
          <div className="mb-1 font-mono text-[11px] uppercase tracking-wide text-cp-faint">
            Topics solved
          </div>
          <p className="mb-3 text-[12px] text-cp-dim">
            Problems by tag across Codeforces &amp; LeetCode.
          </p>
          <TopicChart data={tags} />
        </div>
      ) : null}

      {handles.map((h) => (
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
