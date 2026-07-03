import type { JudgeRequest, JudgeResponse } from "@/lib/judge-types";

/** Judge unreachable / misconfigured — the caller should NOT store a row. */
export class JudgeOfflineError extends Error {
  constructor(detail: string) {
    super(`Judge is offline: ${detail}`);
    this.name = "JudgeOfflineError";
  }
}

/** Submit one judging job to nc-judge. The judge budgets 45s per submission,
 * so 50s covers it with headroom while staying inside Vercel's 60s. */
export async function callJudge(req: JudgeRequest): Promise<JudgeResponse> {
  const base = process.env.JUDGE_URL;
  const secret = process.env.JUDGE_SECRET;
  if (!base || !secret) throw new JudgeOfflineError("not configured");

  let res: Response;
  try {
    res = await fetch(`${base.replace(/\/$/, "")}/judge`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(req),
      signal: AbortSignal.timeout(50_000),
      cache: "no-store",
    });
  } catch (e) {
    throw new JudgeOfflineError(e instanceof Error ? e.message : "network error");
  }

  if (res.status === 429) throw new JudgeOfflineError("busy — try again shortly");
  if (!res.ok) throw new JudgeOfflineError(`HTTP ${res.status}`);
  return (await res.json()) as JudgeResponse;
}
