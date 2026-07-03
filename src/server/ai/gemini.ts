// gemini-2.5-flash has free-tier quota; older 2.0-flash is now limit:0 on new keys.
const DEFAULT_MODEL = "gemini-2.5-flash";

export type GeminiOptions = {
  /** Ask for (and parse) a JSON response; returns the parsed value. */
  json?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  /** 2.5-flash "thinks" by default, eating the token budget before the answer.
   * Defaults to 0 (off); raise it for tasks that benefit from reasoning. */
  thinkingBudget?: number;
  timeoutMs?: number;
  /** Retry HTTP 429 this many times (35s apart) — the free tier is limited
   * per-minute, so batch/CLI callers can just wait. Interactive callers keep
   * the default 0 and fail fast. */
  retry429?: number;
};

/**
 * One raw call to Google Gemini (free tier, key in GEMINI_API_KEY). Returns
 * the response text — or parsed JSON with `json: true` — and null on ANY
 * failure (missing key, network, rate-limit, bad response) so callers can
 * fall back gracefully.
 */
export async function callGemini(prompt: string, opts: GeminiOptions = {}): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: opts.temperature ?? 0.9,
            maxOutputTokens: opts.maxOutputTokens ?? 256,
            thinkingConfig: { thinkingBudget: opts.thinkingBudget ?? 0 },
            ...(opts.json ? { responseMimeType: "application/json" } : {}),
          },
        }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
      });
      if (res.status === 429 && attempt < (opts.retry429 ?? 0)) {
        await new Promise((r) => setTimeout(r, 35_000));
        continue;
      }
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
}

/** `callGemini` with `json: true` + parse; null when the call or parse fails. */
export async function callGeminiJson<T>(prompt: string, opts: GeminiOptions = {}): Promise<T | null> {
  const text = await callGemini(prompt, { ...opts, json: true });
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
