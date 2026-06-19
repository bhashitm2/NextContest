import type { Platform } from "@/generated/prisma/client";

/** A contest normalized to our common schema, before DB upsert. */
export type NormalizedContest = {
  platform: Platform;
  externalId: string;
  title: string;
  url: string;
  startTime: Date;
  endTime: Date;
  durationSeconds: number;
  difficulty: string | null;
};

/** Honest, identifiable user-agent (per our "rate-respectful scrapers" principle). */
export const USER_AGENT =
  "NextContest/0.1 (+https://github.com/; contest aggregator)";

/** fetch JSON with a timeout and an honest UA. Throws on non-2xx. */
export async function fetchJson<T>(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const { timeoutMs = 15_000, headers, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...rest,
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...headers },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Best-effort difficulty/label extraction from a contest title. */
export function difficultyFromTitle(title: string): string | null {
  const div = title.match(/Div\.?\s*\d/i);
  if (div) return div[0].replace(/\s+/g, " ");
  for (const label of ["Educational", "Global", "Biweekly", "Weekly", "Starters", "Beginner", "Grand", "Regular"]) {
    if (title.toLowerCase().includes(label.toLowerCase())) return label;
  }
  return null;
}
