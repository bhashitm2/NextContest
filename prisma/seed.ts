import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { ContestStatus, Platform, type Prisma } from "../src/generated/prisma/client";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function at(offsetMs: number, durationSeconds: number) {
  const startTime = new Date(Date.now() + offsetMs);
  const endTime = new Date(startTime.getTime() + durationSeconds * 1000);
  const status: ContestStatus =
    endTime.getTime() < Date.now()
      ? ContestStatus.FINISHED
      : startTime.getTime() < Date.now()
        ? ContestStatus.ONGOING
        : ContestStatus.UPCOMING;
  return { startTime, endTime, durationSeconds, status };
}

const seedContests: Prisma.ContestCreateInput[] = [
  {
    platform: Platform.CODEFORCES,
    externalId: "cf-1990",
    title: "Codeforces Round 1990 (Div. 2)",
    url: "https://codeforces.com/contest/1990",
    difficulty: "Div. 2",
    ...at(2 * HOUR, 135 * 60),
  },
  {
    platform: Platform.CODEFORCES,
    externalId: "cf-edu-170",
    title: "Educational Codeforces Round 170 (Rated for Div. 2)",
    url: "https://codeforces.com/contest/1991",
    difficulty: "Educational",
    ...at(1.5 * DAY, 120 * 60),
  },
  {
    platform: Platform.LEETCODE,
    externalId: "lc-weekly-410",
    title: "LeetCode Weekly Contest 410",
    url: "https://leetcode.com/contest/weekly-contest-410",
    difficulty: "Weekly",
    ...at(3 * DAY, 90 * 60),
  },
  {
    platform: Platform.LEETCODE,
    externalId: "lc-biweekly-138",
    title: "LeetCode Biweekly Contest 138",
    url: "https://leetcode.com/contest/biweekly-contest-138",
    difficulty: "Biweekly",
    ...at(10 * DAY, 90 * 60),
  },
  {
    platform: Platform.ATCODER,
    externalId: "abc-370",
    title: "AtCoder Beginner Contest 370",
    url: "https://atcoder.jp/contests/abc370",
    difficulty: "Beginner",
    ...at(4 * HOUR, 100 * 60),
  },
  {
    platform: Platform.CODECHEF,
    externalId: "cc-starters-150",
    title: "CodeChef Starters 150 (Rated)",
    url: "https://www.codechef.com/START150",
    difficulty: "Starters",
    ...at(1 * DAY, 120 * 60),
  },
  {
    platform: Platform.CODEFORCES,
    externalId: "cf-1989-past",
    title: "Codeforces Round 1989 (Div. 1)",
    url: "https://codeforces.com/contest/1989",
    difficulty: "Div. 1",
    ...at(-2 * DAY, 150 * 60),
  },
];

async function main() {
  for (const c of seedContests) {
    await prisma.contest.upsert({
      where: { platform_externalId: { platform: c.platform, externalId: c.externalId } },
      update: c,
      create: c,
    });
  }

  // Mark each source as freshly synced so the "stale data" banner stays hidden.
  for (const source of [Platform.CODEFORCES, Platform.LEETCODE, Platform.ATCODER, Platform.CODECHEF]) {
    await prisma.syncState.upsert({
      where: { source },
      update: { lastRunAt: new Date(), lastSuccessAt: new Date(), lastError: null },
      create: { source, lastRunAt: new Date(), lastSuccessAt: new Date() },
    });
  }

  const total = await prisma.contest.count();
  const upcoming = await prisma.contest.count({ where: { status: ContestStatus.UPCOMING } });
  console.log(`Seeded. Total contests: ${total}, upcoming: ${upcoming}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
