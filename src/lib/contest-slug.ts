import type { Platform } from "@/generated/prisma/client";
import { PLATFORM_META } from "@/lib/platforms";

/**
 * Human-readable contest URLs: /contests/codeforces-round-1105-div-2 rather
 * than /contests/<cuid>. The slug is what people type into a search engine, so
 * it is derived from the contest title and then FROZEN — see server/sync/run.ts.
 */

/** Slugs that would shadow (or be shadowed by) a static sibling of
 * /contests/[slug]. Keep in sync with the routes under src/app/contests/. */
const RESERVED = new Set(["past", "upcoming", "archive", "new"]);

/** AtCoder contest ids are already the canonical name people search for, and
 * are far cleaner than the titles (which carry sponsor names and Japanese
 * text). "abc400" → "atcoder-beginner-contest-400". Zero-padding is preserved
 * so the slug matches the official title ("agc078" → "…-contest-078"). */
const ATCODER_SERIES: Record<string, string> = {
  abc: "beginner",
  arc: "regular",
  agc: "grand",
  ahc: "heuristic",
};

export function slugifyTitle(input: string): string {
  return input
    // NFKD folds AtCoder's full-width （）and decomposes accents.
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "") // o'clock → oclock, not o-clock
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export type ContestSlugSource = {
  platform: Platform;
  title: string;
  externalId: string;
};

function atcoderSlug(externalId: string): string | null {
  const m = /^([a-z]+)(\d+)$/i.exec(externalId.trim());
  if (!m) return null;
  const series = ATCODER_SERIES[m[1]!.toLowerCase()];
  return series ? `atcoder-${series}-contest-${m[2]}` : null;
}

/** Canonical slug for a contest. Deterministic; the DB unique index is the
 * final arbiter of collisions (see slugCandidates). */
export function contestSlug(c: ContestSlugSource): string {
  if (c.platform === "ATCODER") {
    const fromId = atcoderSlug(c.externalId);
    if (fromId) return fromId;
  }

  const platformToken = slugifyTitle(PLATFORM_META[c.platform].label);
  // Japanese-only titles can slugify to nothing; fall back to the id.
  const base = slugifyTitle(c.title) || slugifyTitle(c.externalId);

  // Prefix the platform only when the title doesn't already name it — a
  // startsWith test would yield "codeforces-educational-codeforces-round-180".
  const names =
    base === platformToken ||
    base.startsWith(`${platformToken}-`) ||
    base.endsWith(`-${platformToken}`) ||
    base.includes(`-${platformToken}-`);
  const slug = names ? base : `${platformToken}-${base}`;

  return RESERVED.has(slug) ? `${slug}-${slugifyTitle(c.externalId)}` : slug;
}

/** Slugs to try, in order, when writing. Later candidates disambiguate two
 * contests that share a title (e.g. repeated "Starters 185"). */
export function slugCandidates(c: ContestSlugSource): string[] {
  const base = contestSlug(c);
  const ext = slugifyTitle(c.externalId);
  const withExt = ext && !base.endsWith(ext) ? `${base}-${ext}` : `${base}-2`;
  return [base, withExt, `${withExt}-2`];
}

/** The one place that builds a contest URL. Falls back to the cuid so a row
 * whose slug hasn't been backfilled yet still resolves (the page accepts both). */
export function contestPath(
  contest: { id: string; slug?: string | null },
  sub?: "predict" | "compare",
): string {
  return `/contests/${contest.slug ?? contest.id}${sub ? `/${sub}` : ""}`;
}
