// Wire types for the nc-judge microservice. Hand-mirrored from
// judge/src/types.ts — keep the two in sync (tiny, changes rarely).

export type JudgeLanguage = "PYTHON" | "CPP" | "JAVA";

export type JudgeVerdict = "AC" | "WA" | "TLE" | "MLE" | "RE" | "CE" | "JUDGE_ERROR";

export type JudgeTestStatus = "AC" | "WA" | "TLE" | "MLE" | "RE" | "SKIPPED";

export type JudgeRequest = {
  language: JudgeLanguage;
  source: string;
  tests: { input: string; expected: string }[];
  timeLimitMs: number;
  memoryMb: number;
  /** Authoring mode: include each test's raw stdout in the response. */
  returnOutput?: boolean;
};

export type JudgeTestResult = {
  status: JudgeTestStatus;
  timeMs: number;
  output?: string;
  /** returnOutput mode only: the run's stderr (tracebacks for authoring). */
  stderr?: string;
};

export type JudgeResponse = {
  verdict: JudgeVerdict;
  tests: JudgeTestResult[];
  compileOutput?: string;
  /** Max wall time across executed tests. */
  timeMs: number;
};

export const JUDGE_LIMITS = {
  maxTests: 12,
  maxSourceBytes: 64 * 1024,
} as const;
