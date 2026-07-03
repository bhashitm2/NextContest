/**
 * Build the problem bank from scripts/problem-archetypes.json — resumable and
 * Gemini-free-tier friendly (skips slugs already in the DB, pauses between
 * problems, stops early with --limit).
 *
 *   npx tsx scripts/author-batch.ts [--limit 10] [--from <slug>]
 *
 * Run it over multiple evenings; every problem lands as DRAFT for review.
 */
import "dotenv/config";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { prisma } from "../src/lib/db";
import { authorProblem, type Archetype } from "./lib-author";

const PAUSE_MS = 20_000; // ~2 Gemini calls/problem worst case → well under 10 RPM

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const all = JSON.parse(
    readFileSync(join(__dirname, "problem-archetypes.json"), "utf8"),
  ) as Archetype[];

  const limit = argValue("--limit") ? Number(argValue("--limit")) : Infinity;
  const from = argValue("--from");
  const start = from ? all.findIndex((a) => a.slug === from) : 0;
  if (start < 0) throw new Error(`--from slug "${from}" not in archetypes`);

  const existing = new Set(
    (await prisma.problem.findMany({ select: { slug: true } })).map((p) => p.slug),
  );

  let authored = 0;
  let failed = 0;
  for (const a of all.slice(start)) {
    if (authored >= limit) break;
    if (existing.has(a.slug)) {
      console.log(`[${a.slug}] exists — skipping`);
      continue;
    }
    const result = await authorProblem(a);
    if (result.ok) authored++;
    else {
      failed++;
      console.error(`[${a.slug}] FAILED: ${result.error}`);
      // Judge down or key exhausted → later ones will fail too; stop.
      if (result.error.startsWith("judge unreachable")) break;
    }
    await sleep(PAUSE_MS);
  }

  console.log(`\nDone: ${authored} authored, ${failed} failed.`);
}

main().finally(() => prisma.$disconnect());
