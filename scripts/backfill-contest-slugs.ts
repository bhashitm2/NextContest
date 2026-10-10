/**
 * One-off backfill: compute Contest.slug for every row that doesn't have one
 * (the column ships nullable in migration 20260920000000_contest_slug).
 *
 *   npx tsx scripts/backfill-contest-slugs.ts --dry   # print, write nothing
 *   npx tsx scripts/backfill-contest-slugs.ts         # write
 *
 * Uses DATABASE_URL from .env like the app. Rows are processed oldest-first so
 * the contest most likely to already be indexed keeps the clean slug and any
 * later duplicate title takes the disambiguating suffix.
 *
 * The slug is NOT recomputed for rows that already have one — see
 * server/sync/run.ts for why contest URLs are frozen once a contest starts.
 */
import "dotenv/config";

import { slugCandidates } from "../src/lib/contest-slug";
import { prisma } from "../src/lib/db";

async function main() {
  const dry = process.argv.includes("--dry");

  const rows = await prisma.contest.findMany({
    select: { id: true, platform: true, externalId: true, title: true, slug: true },
    orderBy: { startTime: "asc" },
  });

  const taken = new Set(rows.map((r) => r.slug).filter((s): s is string => Boolean(s)));

  let filled = 0;
  let suffixed = 0;
  for (const row of rows) {
    if (row.slug) continue;

    const candidates = slugCandidates(row);
    // Last resort keeps the run deterministic even if all candidates collide.
    const slug = candidates.find((s) => !taken.has(s)) ?? `${candidates[0]}-${row.id.slice(-6)}`;
    if (slug !== candidates[0]) suffixed++;
    taken.add(slug);

    console.log(`${dry ? "would set" : "set"}  ${row.platform.padEnd(10)}  ${slug}`);
    console.log(`          ${" ".repeat(10)}  <= ${row.title}`);
    if (!dry) await prisma.contest.update({ where: { id: row.id }, data: { slug } });
    filled++;
  }

  console.log(
    `\n${dry ? "DRY RUN — nothing written. " : ""}` +
      `${filled} of ${rows.length} rows ${dry ? "would be" : ""} filled, ` +
      `${suffixed} needed a disambiguating suffix, ${taken.size} unique slugs.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
