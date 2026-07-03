/**
 * Author ONE practice problem via Gemini + the real judge.
 *
 *   npx tsx scripts/author-problem.ts "<archetype prompt>" --slug two-sum \
 *     --difficulty 1000 --tags "arrays,hash map" [--time-limit 2000] [--force]
 *
 * Requires GEMINI_API_KEY + JUDGE_URL + JUDGE_SECRET in .env and a running
 * nc-judge. The problem is stored as DRAFT for review at /practice/<slug>.
 */
import "dotenv/config";

import { prisma } from "../src/lib/db";
import { authorProblem } from "./lib-author";

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const prompt = process.argv[2];
  const slug = argValue("--slug");
  const difficulty = Number(argValue("--difficulty"));
  const tags = (argValue("--tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (!prompt || prompt.startsWith("--") || !slug || !Number.isFinite(difficulty)) {
    console.error(
      'Usage: npx tsx scripts/author-problem.ts "<archetype>" --slug <slug> --difficulty <800-2400> --tags "a,b" [--time-limit ms] [--force]',
    );
    process.exit(1);
  }

  const result = await authorProblem(
    {
      slug,
      difficulty,
      tags,
      prompt,
      timeLimitMs: argValue("--time-limit") ? Number(argValue("--time-limit")) : undefined,
    },
    { force: process.argv.includes("--force") },
  );

  if (!result.ok) {
    console.error(`FAILED: ${result.error}`);
    process.exitCode = 1;
  }
}

main().finally(() => prisma.$disconnect());
