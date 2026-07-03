/**
 * nc-judge self-test: exercises the runner directly (no HTTP) against the
 * local Docker daemon — every verdict path in all three languages.
 *   npm run self-test        (in judge/)
 */
import { normalizeOutput, outputsMatch } from "./compare.js";
import { judgeSubmission } from "./runner.js";
import type { JudgeLanguage, JudgeRequest, Verdict } from "./types.js";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) console.log(`ok   ${name}`);
  else {
    failures++;
    console.error(`FAIL ${name}`, detail ?? "");
  }
}

// --- pure compare checks ---
check("compare: trailing spaces + CRLF", outputsMatch("a \r\nb\r\n", "a\nb"), true);
check("compare: trailing blank lines", outputsMatch("42\n\n\n", "42"), true);
check("compare: inner spacing matters", !outputsMatch("1  2", "1 2"));
check("normalize idempotent", normalizeOutput("x\n") === "x");

// --- per-language sources ---
const doubler: Record<JudgeLanguage, string> = {
  PYTHON: "print(int(input())*2)",
  CPP: "#include <iostream>\nint main(){long long x;std::cin>>x;std::cout<<x*2;}",
  JAVA: "import java.util.*;class Main{public static void main(String[] a){System.out.println(new Scanner(System.in).nextLong()*2);}}",
};
const loopForever: Record<JudgeLanguage, string> = {
  PYTHON: "while True:\n    pass",
  CPP: "int main(){for(;;){}}",
  JAVA: "class Main{public static void main(String[] a){while(true){}}}",
};
const crash: Record<JudgeLanguage, string> = {
  PYTHON: "print(1//0)",
  CPP: "#include <cstdlib>\nint main(){std::abort();}",
  JAVA: "class Main{public static void main(String[] a){throw new RuntimeException();}}",
};

function run(language: JudgeLanguage, source: string, overrides: Partial<JudgeRequest> = {}) {
  return judgeSubmission({
    language,
    source,
    tests: [
      { input: "21\n", expected: "42" },
      { input: "5\n", expected: "10" },
    ],
    timeLimitMs: 1000,
    memoryMb: 256,
    ...overrides,
  });
}

async function expectVerdict(name: string, p: Promise<{ verdict: Verdict }>, want: Verdict) {
  const r = await p;
  check(name, r.verdict === want, r);
  return r;
}

async function main() {
  for (const lang of ["PYTHON", "CPP", "JAVA"] as const) {
    const t0 = Date.now();
    await expectVerdict(`${lang}: AC`, run(lang, doubler[lang]), "AC");
    console.log(`     (${Date.now() - t0}ms)`);
    await expectVerdict(
      `${lang}: WA`,
      run(lang, doubler[lang], { tests: [{ input: "21\n", expected: "43" }] }),
      "WA",
    );
    await expectVerdict(`${lang}: TLE`, run(lang, loopForever[lang]), "TLE");
    await expectVerdict(`${lang}: RE`, run(lang, crash[lang]), "RE");
  }

  // CE (compiled languages only)
  await expectVerdict(
    "CPP: CE",
    run("CPP", "int main({"),
    "CE",
  );
  await expectVerdict("JAVA: CE", run("JAVA", "class Main { broken"), "CE");

  // MLE: allocate far beyond the limit (python touches pages as it builds).
  await expectVerdict(
    "PYTHON: MLE",
    run("PYTHON", "a = bytearray(1024*1024*1024)\nprint(len(a))", {
      tests: [{ input: "", expected: "x" }],
    }),
    "MLE",
  );

  // Early exit: first test fails → second SKIPPED
  const early = await run("PYTHON", "print('nope')");
  check(
    "early exit: rest skipped",
    early.verdict === "WA" && early.tests[1]?.status === "SKIPPED",
    early.tests,
  );

  // Network is off: any egress attempt must fail (RE), not hang
  await expectVerdict(
    "network egress blocked",
    run(
      "PYTHON",
      "import urllib.request\nurllib.request.urlopen('https://example.com', timeout=3)",
      { tests: [{ input: "", expected: "x" }], timeLimitMs: 3000 },
    ),
    "RE",
  );

  // Fork bomb contained by --pids-limit (verdict RE or TLE, machine survives)
  const bomb = await run("PYTHON", "import os\nwhile True: os.fork()", {
    tests: [{ input: "", expected: "x" }],
  });
  check("fork bomb contained", bomb.verdict === "RE" || bomb.verdict === "TLE", bomb.verdict);

  // returnOutput mode surfaces stdout and never early-exits (authoring runs
  // have empty `expected`, so every status reads WA)
  const authored = await run("PYTHON", "print(int(input())*2)", {
    tests: [
      { input: "7\n", expected: "" },
      { input: "9\n", expected: "" },
    ],
    returnOutput: true,
  });
  check("returnOutput exposes stdout", authored.tests[0]?.output?.trim() === "14", authored.tests[0]);
  check(
    "returnOutput runs all tests (no early exit)",
    authored.tests[1]?.status === "WA" && authored.tests[1]?.output?.trim() === "18",
    authored.tests[1],
  );

  if (failures > 0) {
    console.error(`\n${failures} failure(s)`);
    process.exit(1);
  }
  console.log("\nAll nc-judge self-tests passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
