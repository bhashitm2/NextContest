import { createHash } from "node:crypto";

import type { CompareResult, Winner } from "@/lib/compare";

// gemini-2.5-flash has free-tier quota; older 2.0-flash is now limit:0 on new keys.
const DEFAULT_MODEL = "gemini-2.5-flash";

/** Display label for a side of the comparison. */
function nameOf(side: CompareResult["a"], fallback: string): string {
  return side.name ?? side.username ?? fallback;
}

/** Resolve a winner token to the actual competitor name (or "tie"). */
function winnerName(winner: Winner, a: string, b: string): string {
  return winner === "tie" ? "tie" : winner === "a" ? a : b;
}

/**
 * Order-independent fingerprint of the comparison numbers. Sorting each pair of
 * values means both view directions (X vs Y and Y vs X) hash identically, so a
 * single cached verdict serves both — and the hash still changes whenever any
 * stat (or a display name) changes, triggering regeneration.
 */
export function statsHash(r: CompareResult): string {
  const cats = r.categories
    .map((c) => `${c.key}:${[c.aValue, c.bValue].sort((x, y) => x - y).join("/")}`)
    .sort();
  const topics = r.topics.leads
    .map((t) => `${t.tag}:${[t.aCount, t.bCount].sort((x, y) => x - y).join("/")}`)
    .sort();
  const names = [nameOf(r.a, ""), nameOf(r.b, "")].sort();
  const canonical = JSON.stringify({ names, cats, topics });
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

/** Compact, name-keyed JSON the model narrates from (never asked to do math). */
function promptData(r: CompareResult, aName: string, bName: string) {
  return {
    players: [aName, bName],
    overall_winner: winnerName(r.overall.winner, aName, bName),
    score: `${r.overall.aScore}-${r.overall.bScore}`,
    metrics: r.categories.map((c) => ({
      metric: c.label,
      [aName]: c.aValue,
      [bName]: c.bValue,
      leader: winnerName(c.winner, aName, bName),
    })),
    top_topics: r.topics.leads.slice(0, 6).map((t) => ({
      topic: t.tag,
      [aName]: t.aCount,
      [bName]: t.bCount,
      leader: winnerName(t.winner, aName, bName),
    })),
  };
}

/**
 * Ask Google Gemini (free tier) to narrate the already-computed comparison.
 * Returns the verdict text, or `null` on any failure (missing key, network,
 * rate-limit, bad response) so the caller can fall back gracefully — AI never
 * blocks the comparison.
 */
export async function generateVerdict(r: CompareResult): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const aName = nameOf(r.a, "Player A");
  const bName = nameOf(r.b, "Player B");

  const prompt =
    "You are a witty competitive-programming commentator. Two coders are compared " +
    "head-to-head. Using ONLY the numbers in the JSON below (never invent a stat), " +
    "write a fun, punchy 2-3 sentence verdict: call out who leads which area and " +
    "declare the overall winner. Under 60 words, upbeat and a little cheeky. Refer " +
    "to the players by name. Output plain text only.\n\nDATA:\n" +
    JSON.stringify(promptData(r, aName, bName));

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 256,
          // 2.5-flash "thinks" by default, which would consume the token budget
          // before the answer. We just need a short hype line — disable thinking.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = json.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim();
    return text && text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

/** Deterministic templated verdict used when the AI is unavailable. */
export function fallbackVerdict(r: CompareResult): string {
  const aName = nameOf(r.a, "Player A");
  const bName = nameOf(r.b, "Player B");

  if (r.overall.winner === "tie") {
    return `${aName} and ${bName} are neck and neck — a genuine dead heat at ${r.overall.aScore}-${r.overall.bScore}!`;
  }

  const winner = r.overall.winner === "a" ? aName : bName;
  const leads = r.categories
    .filter((c) => c.winner !== "tie")
    .slice(0, 2)
    .map((c) => `${winnerName(c.winner, aName, bName)} on ${c.label.toLowerCase()}`);

  const detail = leads.length > 0 ? ` Standout leads — ${leads.join(", ")}.` : "";
  return `${winner} takes it ${r.overall.aScore}-${r.overall.bScore}!${detail}`;
}
