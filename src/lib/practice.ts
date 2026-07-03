import type { JudgeLanguage, JudgeTestStatus, JudgeVerdict } from "@/lib/judge-types";

export const LANGUAGE_OPTIONS: { value: JudgeLanguage; label: string }[] = [
  { value: "CPP", label: "C++" },
  { value: "PYTHON", label: "Python" },
  { value: "JAVA", label: "Java" },
];

/** What a fresh editor opens with — bare minimum, no boilerplate. Java MUST
 * be `class Main` (the judge compiles Main.java). */
export const STARTER_TEMPLATES: Record<JudgeLanguage, string> = {
  CPP: `#include <bits/stdc++.h>
using namespace std;

int main() {

    return 0;
}
`,
  PYTHON: `
`,
  JAVA: `import java.util.*;

class Main {
    public static void main(String[] args) {

    }
}
`,
};

/** LeetCode-style difficulty tiers, derived from the stored CF-style rating
 * (kept numeric in the DB for ordering and future fine-grained filters). */
export type DifficultyTier = { label: "Easy" | "Medium" | "Hard"; color: string };

export function difficultyTier(difficulty: number): DifficultyTier {
  if (difficulty >= 1900) return { label: "Hard", color: "#ef4444" };
  if (difficulty >= 1300) return { label: "Medium", color: "#f59e0b" };
  return { label: "Easy", color: "#22c55e" };
}

export const VERDICT_META: Record<JudgeVerdict, { label: string; color: string }> = {
  AC: { label: "Accepted", color: "#22c55e" },
  WA: { label: "Wrong Answer", color: "#ef4444" },
  TLE: { label: "Time Limit Exceeded", color: "#f59e0b" },
  MLE: { label: "Memory Limit Exceeded", color: "#f59e0b" },
  RE: { label: "Runtime Error", color: "#ef4444" },
  CE: { label: "Compile Error", color: "#a855f7" },
  JUDGE_ERROR: { label: "Judge Error", color: "#9ca3af" },
};

export function testStatusColor(status: JudgeTestStatus): string {
  if (status === "AC") return "#22c55e";
  if (status === "TLE" || status === "MLE") return "#f59e0b";
  if (status === "SKIPPED") return "var(--cp-faint)";
  return "#ef4444";
}
