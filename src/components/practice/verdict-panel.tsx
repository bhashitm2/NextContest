"use client";

import type { JudgeTestStatus, JudgeVerdict } from "@/lib/judge-types";
import { testStatusColor, VERDICT_META } from "@/lib/practice";

export type VerdictResult = {
  verdict: JudgeVerdict;
  tests: { status: JudgeTestStatus; timeMs: number }[];
  compileOutput: string | null;
};

/** Verdict pill + one dot per test (hover shows status and time). */
export function VerdictPanel({ result }: { result: VerdictResult }) {
  const meta = VERDICT_META[result.verdict];
  const passed = result.tests.filter((t) => t.status === "AC").length;

  return (
    <div className="rounded-[12px] border border-cp-line bg-cp-surface p-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="rounded-full px-2.5 py-1 font-mono text-[12px] font-bold"
          style={{
            color: meta.color,
            backgroundColor: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
          }}
        >
          {meta.label}
        </span>
        {result.verdict !== "CE" ? (
          <span className="font-mono text-[12px] text-cp-dim">
            {passed}/{result.tests.length} tests
          </span>
        ) : null}
      </div>

      {result.verdict !== "CE" && result.tests.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {result.tests.map((t, i) => (
            <span
              key={i}
              title={`Test ${i + 1}: ${t.status}${t.status !== "SKIPPED" ? ` (${t.timeMs}ms)` : ""}`}
              className="grid size-6 place-items-center rounded-md font-mono text-[10px] font-bold"
              style={{
                color: testStatusColor(t.status),
                backgroundColor: `color-mix(in srgb, ${testStatusColor(t.status)} 12%, transparent)`,
              }}
            >
              {i + 1}
            </span>
          ))}
        </div>
      ) : null}

      {result.compileOutput ? (
        <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-[10px] border border-cp-line bg-cp-bg-soft p-3 font-mono text-[12px] leading-relaxed text-red-400">
          {result.compileOutput}
        </pre>
      ) : null}
    </div>
  );
}
