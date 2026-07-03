/**
 * Server-side E2E for /practice against the shared DB + a locally running
 * nc-judge (JUDGE_URL/JUDGE_SECRET from .env). Seeds one throwaway DRAFT
 * problem, exercises the real tRPC procedures via createCaller, then deletes
 * everything it created.
 *
 *   npx tsx scripts/test-practice-e2e.ts
 */
import "dotenv/config";

import { prisma } from "../src/lib/db";
import { createCaller } from "../src/server/routers/_app";

const SLUG = "e2e-throwaway-double-it";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

let failures = 0;
function assert(cond: boolean, name: string, detail?: unknown) {
  if (cond) console.log(`ok   ${name}`);
  else {
    failures++;
    console.error(`FAIL ${name}`, detail ?? "");
  }
}

async function expectCode(name: string, p: Promise<unknown>, code: string) {
  try {
    await p;
    assert(false, name, "did not throw");
  } catch (e) {
    assert((e as { code?: string }).code === code, name, e);
  }
}

async function main() {
  if (!ADMIN_EMAIL) throw new Error("ADMIN_EMAIL not set");
  const admin = await prisma.user.findFirst({
    where: { email: ADMIN_EMAIL },
    select: { id: true },
  });
  if (!admin) throw new Error(`no user with email ${ADMIN_EMAIL}`);
  const other = await prisma.user.findFirst({
    where: { id: { not: admin.id } },
    select: { id: true },
  });
  if (!other) throw new Error("need a second user");

  const asAdmin = createCaller({ db: prisma, userId: admin.id, headers: new Headers() });
  const asOther = createCaller({ db: prisma, userId: other.id, headers: new Headers() });
  const asGuest = createCaller({ db: prisma, userId: null, headers: new Headers() });

  // --- seed a DRAFT problem (1 sample + 2 hidden tests) ---
  await prisma.problem.deleteMany({ where: { slug: SLUG } });
  await prisma.problem.create({
    data: {
      slug: SLUG,
      title: "E2E: Double It",
      statementMd: "Read an integer, print it doubled.",
      difficulty: 800,
      tags: ["math"],
      status: "DRAFT",
      tests: {
        create: [
          { ord: 0, input: "21\n", expected: "42", hidden: false },
          { ord: 1, input: "0\n", expected: "0", hidden: true },
          { ord: 2, input: "-7\n", expected: "-14", hidden: true },
        ],
      },
    },
  });

  // --- visibility: DRAFT is admin-only ---
  const adminList = await asAdmin.practice.list();
  assert(
    adminList.isAdmin && adminList.problems.some((p) => p.slug === SLUG),
    "admin sees DRAFT in list",
  );
  const otherList = await asOther.practice.list();
  assert(
    !otherList.isAdmin && !otherList.problems.some((p) => p.slug === SLUG),
    "non-admin does not see DRAFT",
  );
  await expectCode("non-admin get(DRAFT) → NOT_FOUND", asOther.practice.get({ slug: SLUG }), "NOT_FOUND");
  await expectCode("guest get(DRAFT) → NOT_FOUND", asGuest.practice.get({ slug: SLUG }), "NOT_FOUND");

  const got = await asAdmin.practice.get({ slug: SLUG });
  assert(got.problem.tests.length === 1, "get returns samples only (hidden stay server-side)");

  // --- submissions through the real judge ---
  const ac = await asAdmin.practice.submit({
    slug: SLUG,
    language: "PYTHON",
    source: "print(int(input())*2)",
  });
  assert(ac.verdict === "AC" && ac.submission.passedCount === 3, "PYTHON AC on all 3 tests", ac);

  const wa = await asAdmin.practice.submit({
    slug: SLUG,
    language: "CPP",
    source: "#include <iostream>\nint main(){long long x;std::cin>>x;std::cout<<x*2+1;}",
  });
  assert(
    wa.verdict === "WA" && wa.tests[1]?.status === "SKIPPED",
    "CPP WA + early-exit skips rest",
    wa,
  );

  const ce = await asAdmin.practice.submit({ slug: SLUG, language: "JAVA", source: "class Main {" });
  assert(ce.verdict === "CE" && !!ce.compileOutput, "JAVA CE surfaces compiler output", ce);

  // --- non-admin cannot submit to a DRAFT ---
  await expectCode(
    "non-admin submit(DRAFT) → NOT_FOUND",
    asOther.practice.submit({ slug: SLUG, language: "PYTHON", source: "print(1)" }),
    "NOT_FOUND",
  );

  // --- publish flow + solved tick + history ---
  await expectCode(
    "non-admin setStatus → FORBIDDEN",
    asOther.practice.setStatus({ slug: SLUG, status: "PUBLISHED" }),
    "FORBIDDEN",
  );
  const pub = await asAdmin.practice.setStatus({ slug: SLUG, status: "PUBLISHED" });
  assert(pub.status === "PUBLISHED", "admin publishes");
  const otherList2 = await asOther.practice.list();
  assert(otherList2.problems.some((p) => p.slug === SLUG), "published problem visible to all");

  const adminList2 = await asAdmin.practice.list();
  assert(adminList2.solvedSlugs.includes(SLUG), "solved tick derived from AC submission");

  const got2 = await asAdmin.practice.get({ slug: SLUG });
  assert(got2.mySubmissions.length === 3, "submission history returned (3 rows)", got2.mySubmissions.length);

  // --- guest cannot submit at all ---
  await expectCode(
    "guest submit → UNAUTHORIZED",
    asGuest.practice.submit({ slug: SLUG, language: "PYTHON", source: "print(1)" }),
    "UNAUTHORIZED",
  );

  if (failures) {
    console.error(`\n${failures} failure(s)`);
    process.exitCode = 1;
  } else console.log("\nAll practice E2E checks passed.");
}

main()
  .finally(async () => {
    await prisma.problem.deleteMany({ where: { slug: SLUG } }); // cascades tests + submissions
    await prisma.$disconnect();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
