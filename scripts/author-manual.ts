/**
 * Author a HAND-WRITTEN problem through the same validation pipeline as the
 * AI path (generators materialized in the sandbox, reference solution judged,
 * its outputs adopted as expected answers, saved as DRAFT for review).
 *
 *   npx tsx scripts/author-manual.ts scripts/manual/<slug>.ts [--force]
 *
 * The draft module default-exports `{ archetype, draft }`.
 */
import "dotenv/config";

import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

import { prisma } from "../src/lib/db";
import { authorFromDraft, type Archetype, type Draft } from "./lib-author";

async function main() {
  const file = process.argv[2];
  if (!file || file.startsWith("--")) {
    console.error("Usage: npx tsx scripts/author-manual.ts scripts/manual/<slug>.ts [--force]");
    process.exit(1);
  }

  const mod = (await import(pathToFileURL(resolve(file)).href)) as {
    default: { archetype: Archetype; draft: Draft };
  };
  const { archetype, draft } = mod.default;

  const result = await authorFromDraft(archetype, draft, {
    force: process.argv.includes("--force"),
  });
  if (!result.ok) {
    console.error(`FAILED: ${result.error}`);
    process.exitCode = 1;
  }
}

main().finally(() => prisma.$disconnect());
