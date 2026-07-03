// Wire types for nc-judge. Mirrored in the Next app at src/lib/judge-types.ts —
// keep the two in sync by hand (they're tiny and change rarely).

export type JudgeLanguage = "PYTHON" | "CPP" | "JAVA";

export type Verdict = "AC" | "WA" | "TLE" | "MLE" | "RE" | "CE" | "JUDGE_ERROR";

export type TestStatus = "AC" | "WA" | "TLE" | "MLE" | "RE" | "SKIPPED";

export type JudgeRequest = {
  language: JudgeLanguage;
  source: string;
  tests: { input: string; expected: string }[];
  timeLimitMs: number;
  memoryMb: number;
  /** Authoring mode: include each test's raw stdout in the response. */
  returnOutput?: boolean;
};

export type TestResult = {
  status: TestStatus;
  timeMs: number;
  output?: string;
  /** returnOutput mode only: the run's stderr (tracebacks for authoring). */
  stderr?: string;
};

export type JudgeResponse = {
  verdict: Verdict;
  tests: TestResult[];
  compileOutput?: string;
  /** Max wall time across executed tests (rough signal for the UI). */
  timeMs: number;
};

export const LIMITS = {
  maxTests: 12,
  maxTimeLimitMs: 3000,
  minTimeLimitMs: 250,
  maxMemoryMb: 512,
  minMemoryMb: 64,
  maxSourceBytes: 64 * 1024,
  maxInputBytes: 256 * 1024,
} as const;
