/**
 * Unit tests for the contest slug rules (src/lib/contest-slug.ts).
 *
 *   npx tsx scripts/test-contest-slug.ts
 *
 * Pure — no DB, no network. These slugs are public URLs that get indexed and
 * linked, so the rules must not drift silently; every case below is a real
 * title shape taken from the four contest fetchers.
 */
import type { Platform } from "../src/generated/prisma/client";
import { contestPath, contestSlug, slugCandidates, slugifyTitle } from "../src/lib/contest-slug";

let failures = 0;
function assert(cond: boolean, name: string, detail?: unknown) {
  if (cond) console.log(`ok   ${name}`);
  else {
    failures++;
    console.error(`FAIL ${name}`, detail ?? "");
  }
}

function eq(platform: Platform, externalId: string, title: string, expected: string) {
  const got = contestSlug({ platform, externalId, title });
  assert(got === expected, `${platform} "${title}" -> ${expected}`, got === expected ? undefined : `got ${got}`);
}

// --- Codeforces: the platform token is already in the title ------------------
eq("CODEFORCES", "2145", "Codeforces Round 1105 (Div. 2)", "codeforces-round-1105-div-2");
eq("CODEFORCES", "2100", "Educational Codeforces Round 180 (Rated for Div. 2)",
  "educational-codeforces-round-180-rated-for-div-2");
eq("CODEFORCES", "2050", "Codeforces Global Round 30", "codeforces-global-round-30");
// ...and where it is not, it gets prefixed.
eq("CODEFORCES", "1999", "April Fools Day Contest 2026", "codeforces-april-fools-day-contest-2026");

// --- LeetCode ---------------------------------------------------------------
eq("LEETCODE", "weekly-contest-445", "Weekly Contest 445", "leetcode-weekly-contest-445");
eq("LEETCODE", "biweekly-contest-158", "Biweekly Contest 158", "leetcode-biweekly-contest-158");

// --- AtCoder: derived from the id, which is cleaner than the title ----------
eq("ATCODER", "abc400", "AtCoder Beginner Contest 400", "atcoder-beginner-contest-400");
eq("ATCODER", "agc078", "AtCoder Grand Contest 078", "atcoder-grand-contest-078"); // zero-padding kept
eq("ATCODER", "arc231", "AtCoder Regular Contest++ 231", "atcoder-regular-contest-231");
// Sponsored/Japanese titles would otherwise bloat or collapse to nothing.
eq("ATCODER", "abc362", "TOYOTA SYSTEMS Programming Contest 2024（AtCoder Beginner Contest 362）",
  "atcoder-beginner-contest-362");
// A non-series AtCoder id falls back to the title, still platform-prefixed.
eq("ATCODER", "aal001", "AAL Contest 001: Let's use segtree!", "atcoder-aal-contest-001-lets-use-segtree");

// --- CodeChef ---------------------------------------------------------------
eq("CODECHEF", "START185", "Starters 185", "codechef-starters-185");
eq("CODECHEF", "START186", "Starters 186 (Rated till 6-star)", "codechef-starters-186-rated-till-6-star");

// --- slugifyTitle edge cases ------------------------------------------------
assert(slugifyTitle("Let's  use   segtree!") === "lets-use-segtree", "apostrophes drop, runs collapse", slugifyTitle("Let's  use   segtree!"));
assert(slugifyTitle("みんなのプロコン 2019") === "2019", "CJK strips to the digits", slugifyTitle("みんなのプロコン 2019"));
assert(slugifyTitle("---") === "", "separator-only input is empty");
assert(slugifyTitle("a".repeat(200)).length <= 80, "capped at 80 chars");
assert(!slugifyTitle("Round (Div. 2) ").endsWith("-"), "never ends with a separator");

// A Japanese-only AtCoder title still produces something usable (id fallback).
assert(contestSlug({ platform: "ATCODER", externalId: "other2019", title: "みんなのプロコン" }).length > 0,
  "empty slugified title falls back to the id");

// --- reserved words can't shadow a static sibling route ---------------------
const reserved = contestSlug({ platform: "CODEFORCES", externalId: "9", title: "Codeforces Past" });
assert(reserved !== "past", `reserved word avoided (got ${reserved})`);

// --- collision ladder -------------------------------------------------------
const cands = slugCandidates({ platform: "CODECHEF", externalId: "START250D", title: "Starters 250" });
assert(cands[0] === "codechef-starters-250", "first candidate is the clean slug", cands);
assert(new Set(cands).size === cands.length, "candidates are distinct", cands);
assert(cands.length >= 2, "there is at least one fallback candidate");

// --- contestPath ------------------------------------------------------------
assert(contestPath({ id: "cuid1", slug: "leetcode-weekly-contest-445" }) === "/contests/leetcode-weekly-contest-445",
  "contestPath prefers the slug");
assert(contestPath({ id: "cuid1", slug: null }) === "/contests/cuid1", "contestPath falls back to the cuid");
assert(contestPath({ id: "cuid1", slug: "abc" }, "predict") === "/contests/abc/predict", "contestPath sub-route");

console.log(failures === 0 ? "\nAll slug tests passed." : `\n${failures} test(s) FAILED.`);
process.exitCode = failures === 0 ? 0 : 1;
