import { type ProfileStats } from "./types";

// GeeksforGeeks rejects non-browser User-Agents, so present a browser UA.
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

// GeeksforGeeks is a profile-only platform: we surface "question completion"
// (total problems solved). GFG server-renders the profile data into the page
// (Next.js RSC payload, escaped JSON) — there's no clean public JSON API and no
// per-difficulty split exposed, so we parse the embedded numbers from the HTML.
const PROFILE = (handle: string) =>
  `https://www.geeksforgeeks.org/profile/${encodeURIComponent(handle)}`;

async function loadProfileHtml(handle: string): Promise<string> {
  const res = await fetch(PROFILE(handle), {
    headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`GeeksforGeeks HTTP ${res.status}`);
  return res.text();
}

/** Pull an integer field out of the escaped-JSON RSC payload (handles both
 * `"key":123` and `\"key\":123` forms). */
function embeddedInt(html: string, key: string): number | null {
  const m = html.match(new RegExp(`${key}\\\\?":\\s*(\\d+)`));
  return m ? Number(m[1]) : null;
}

/** Pure: extract normalized stats from a GFG profile page's HTML. */
export function parseGeeksforGeeksStats(html: string): ProfileStats {
  return {
    rating: null,
    maxRating: null,
    rank: null, // GFG has no public tier/rank label
    problemsSolved: embeddedInt(html, "total_problems_solved"),
    // No per-difficulty split in the GFG payload.
    extra: {},
  };
}

/** Confirm the handle exists (real profiles embed `total_problems_solved`). */
export async function validateGeeksforGeeks(handle: string): Promise<string> {
  const html = await loadProfileHtml(handle);
  if (!/total_problems_solved\\?":/.test(html)) {
    throw new Error("GeeksforGeeks handle not found");
  }
  return handle;
}

/** Text to scan for the verification token — the editable Name (in the payload). */
export async function fetchGeeksforGeeksVerificationField(handle: string): Promise<string> {
  return loadProfileHtml(handle);
}

/** Full per-user stats (question completion). */
export async function fetchGeeksforGeeksStats(handle: string): Promise<ProfileStats> {
  return parseGeeksforGeeksStats(await loadProfileHtml(handle));
}
