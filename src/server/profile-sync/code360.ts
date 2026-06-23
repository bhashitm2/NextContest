import { fetchJson, type ProfileStats } from "./types";

// Code360 (Naukri / Coding Ninjas) is a profile-only platform: we surface DSA
// "question completion" (problems solved by difficulty) + the user level (rank).
// Public, unauthenticated endpoint keyed by username (the SPA's own profile API).
const USER_DETAILS = (handle: string) =>
  `https://www.naukri.com/code360/api/v3/public_section/profile/user_details` +
  `?uuid=${encodeURIComponent(handle)}&app_context=publicsection&naukri_request=true`;

// Naukri rejects non-browser User-Agents, so present a browser UA for this host.
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const HEADERS = {
  "User-Agent": BROWSER_UA,
  Referer: "https://www.naukri.com/code360/",
  "X-Requested-With": "XMLHttpRequest",
};

type DifficultyRow = { level: string; count: number };
type Code360Resp = {
  status?: number;
  data?: {
    name?: string;
    profile?: { name?: string };
    user_level_name?: string;
    dsa_domain_data?: {
      problem_count_data?: { difficulty_data?: DifficultyRow[]; total_count?: number };
    };
  };
};

const levelCount = (rows: DifficultyRow[] | undefined, level: string): number =>
  rows?.find((r) => r.level === level)?.count ?? 0;

/** Pure: map Code360's user_details payload to normalized ProfileStats. */
export function parseCode360Stats(json: Code360Resp): ProfileStats {
  const d = json.data;
  const pc = d?.dsa_domain_data?.problem_count_data;
  const rows = pc?.difficulty_data;
  // Code360 buckets: Easy / Moderate / Hard / Ninja → easy / medium / hard(+ninja).
  const easy = levelCount(rows, "Easy");
  const medium = levelCount(rows, "Moderate");
  const hard = levelCount(rows, "Hard") + levelCount(rows, "Ninja");
  return {
    rating: null, // no public contest rating for most users
    maxRating: null,
    rank: d?.user_level_name ?? null, // e.g. "Specialist", "Achiever", "Ninja"
    problemsSolved: pc?.total_count ?? easy + medium + hard,
    extra: { difficulty: { easy, medium, hard } },
  };
}

async function getUserDetails(handle: string): Promise<Code360Resp> {
  return fetchJson<Code360Resp>(USER_DETAILS(handle), { headers: HEADERS, timeoutMs: 20_000 });
}

/** Confirm the handle exists (the endpoint returns no `data.name` for unknowns). */
export async function validateCode360(handle: string): Promise<string> {
  const json = await getUserDetails(handle);
  if (!json.data?.name) throw new Error("Code360 handle not found");
  return json.data.name;
}

/** Text to scan for the verification token — the editable display Name. */
export async function fetchCode360VerificationField(handle: string): Promise<string> {
  const json = await getUserDetails(handle);
  return json.data?.profile?.name ?? json.data?.name ?? "";
}

/** Full per-user stats (question completion by difficulty + level). */
export async function fetchCode360Stats(handle: string): Promise<ProfileStats> {
  return parseCode360Stats(await getUserDetails(handle));
}
