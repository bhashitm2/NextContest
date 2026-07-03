"use client";

import type { RouterOutputs } from "@/components/friends/friend-row";
import { testStatusColor } from "@/lib/practice";

type RunResult = RouterOutputs["practice"]["run"];

function Block({ label, text, tone }: { label: string; text: string; tone?: "error" }) {
  return (
    <div>
      <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-cp-faint">{label}</div>
      <pre
        className={`max-h-40 overflow-auto whitespace-pre-wrap rounded-[8px] border border-cp-line bg-cp-bg-soft px-2.5 py-1.5 font-mono text-[12px] leading-relaxed ${
          tone === "error" ? "text-red-400" : "text-cp-text"
        }`}
      >
        {text}
      </pre>
    </div>
  );
}

/** Results of a Run (samples or custom input): per-test status with the
 * program's actual output next to the expected one. */
export function RunPanel({ result }: { result: RunResult }) {
  const passed = result.tests.filter((t) => t.status === "AC").length;
  const custom = result.mode === "custom";

  if (result.compileOutput) {
    return (
      <div className="rounded-[12px] border border-cp-line bg-cp-surface p-3.5">
        <span className="rounded-full bg-purple-500/15 px-2.5 py-1 font-mono text-[12px] font-bold text-purple-400">
          Compile Error
        </span>
        <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-[8px] border border-cp-line bg-cp-bg-soft px-2.5 py-1.5 font-mono text-[12px] leading-relaxed text-red-400">
          {result.compileOutput}
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 rounded-[12px] border border-cp-line bg-cp-surface p-3.5">
      <div className="font-mono text-[12px] text-cp-dim">
        {custom
          ? "Custom input run"
          : `Sample tests: ${passed}/${result.tests.length} passed`}
      </div>

      {result.tests.map((t, i) => (
        <div key={i} className="rounded-[10px] border border-cp-line p-2.5">
          <div className="mb-2 flex items-center gap-2.5">
            <span
              className="rounded-md px-1.5 py-0.5 font-mono text-[11px] font-bold"
              style={{
                color: testStatusColor(t.status),
                backgroundColor: `color-mix(in srgb, ${testStatusColor(t.status)} 12%, transparent)`,
              }}
            >
              {custom && t.status === "AC" ? "Finished" : t.status}
            </span>
            {!custom ? (
              <span className="font-mono text-[11px] text-cp-faint">Sample {i + 1}</span>
            ) : null}
            <span className="ml-auto font-mono text-[11px] text-cp-faint">{t.timeMs}ms</span>
          </div>
          <div className="space-y-2">
            {t.input != null ? <Block label="Input" text={t.input} /> : null}
            {t.output != null && t.output.length > 0 ? (
              <Block label="Your output" text={t.output} />
            ) : null}
            {t.expected != null && t.status === "WA" ? (
              <Block label="Expected" text={t.expected} />
            ) : null}
            {t.stderr && (t.status === "RE" || t.status === "MLE") ? (
              <Block label="Stderr" text={t.stderr} tone="error" />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
