"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Shared markdown prose styling for statements and editorials. */
export function MarkdownProse({ markdown }: { markdown: string }) {
  return (
    <div className="prose-statement text-[14.5px] leading-relaxed text-cp-text [&_a]:text-cp-accent [&_code]:rounded [&_code]:bg-cp-bg-soft [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_h1]:mt-5 [&_h1]:text-[18px] [&_h1]:font-bold [&_h2]:mt-5 [&_h2]:text-[16px] [&_h2]:font-bold [&_h3]:mt-4 [&_h3]:text-[15px] [&_h3]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-3 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-[10px] [&_pre]:border [&_pre]:border-cp-line [&_pre]:bg-cp-bg-soft [&_pre]:p-3 [&_table]:my-3 [&_table]:w-full [&_td]:border [&_td]:border-cp-line [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-cp-line [&_th]:px-2 [&_th]:py-1 [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copy"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="grid size-7 place-items-center rounded-lg text-cp-faint transition-colors hover:text-cp-text"
    >
      {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
    </button>
  );
}

function SampleBox({ title, text }: { title: string; text: string }) {
  return (
    <div className="overflow-hidden rounded-[10px] border border-cp-line">
      <div className="flex items-center justify-between border-b border-cp-line bg-cp-bg-soft px-3 py-1">
        <span className="font-mono text-[10px] uppercase tracking-wide text-cp-faint">{title}</span>
        <CopyButton text={text} />
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap px-3 py-2 font-mono text-[12.5px] leading-relaxed text-cp-text">
        {text}
      </pre>
    </div>
  );
}

/** Problem statement (markdown) followed by copyable sample tests. */
export function Statement({
  statementMd,
  samples,
}: {
  statementMd: string;
  samples: { input: string; expected: string }[];
}) {
  return (
    <div>
      <MarkdownProse markdown={statementMd} />

      {samples.length > 0 ? (
        <div className="mt-5 space-y-3">
          <h2 className="font-mono text-[11px] uppercase tracking-wide text-cp-faint">Samples</h2>
          {samples.map((s, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-2">
              <SampleBox title={`Input ${i + 1}`} text={s.input} />
              <SampleBox title={`Output ${i + 1}`} text={s.expected} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
