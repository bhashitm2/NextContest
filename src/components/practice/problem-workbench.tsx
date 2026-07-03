"use client";

import { Eye, FlaskConical, Loader2, Play, RotateCcw, Terminal } from "lucide-react";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";

import type { RouterOutputs } from "@/components/friends/friend-row";
import { DifficultyBadge } from "@/components/practice/difficulty-badge";
import { RunPanel } from "@/components/practice/run-panel";
import { MarkdownProse, Statement } from "@/components/practice/statement";
import { SubmissionList } from "@/components/practice/submission-list";
import { VerdictPanel, type VerdictResult } from "@/components/practice/verdict-panel";
import { Button } from "@/components/ui/button";
import type { JudgeLanguage } from "@/lib/judge-types";
import { LANGUAGE_OPTIONS, STARTER_TEMPLATES } from "@/lib/practice";
import { api } from "@/trpc/react";

const CodeEditor = dynamic(() => import("@/components/practice/code-editor"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full min-h-[300px] place-items-center bg-cp-bg-soft">
      <Loader2 className="size-5 animate-spin text-cp-faint" />
    </div>
  ),
});

type GetData = RouterOutputs["practice"]["get"];
type Tab = "description" | "editorial" | "submissions";

const TABS: { key: Tab; label: string }[] = [
  { key: "description", label: "Description" },
  { key: "editorial", label: "Editorial" },
  { key: "submissions", label: "Submissions" },
];

const draftKey = (slug: string, lang: JudgeLanguage) => `nc-practice-draft:${slug}:${lang}`;

function EditorialTab({ editorialMd }: { editorialMd: string | null }) {
  const [revealed, setRevealed] = useState(false);
  if (!editorialMd) {
    return (
      <p className="px-1 py-6 text-center text-[13px] text-cp-dim">
        No editorial for this problem yet.
      </p>
    );
  }
  if (!revealed) {
    return (
      <div className="rounded-[12px] border border-dashed border-cp-line px-6 py-10 text-center">
        <p className="text-[14px] font-semibold text-cp-text">Spoiler ahead</p>
        <p className="mx-auto mt-1 max-w-[320px] text-[13px] text-cp-dim">
          The editorial explains the intended approach. Give the problem a real shot first!
        </p>
        <Button variant="outline" className="mt-4" onClick={() => setRevealed(true)}>
          <Eye /> Show editorial
        </Button>
      </div>
    );
  }
  return <MarkdownProse markdown={editorialMd} />;
}

/**
 * LeetCode-style workbench: statement pane (Description / Editorial /
 * Submissions tabs) on the left, a full-height code editor on the right,
 * separated by a draggable divider on large screens. Stacks on mobile.
 */
export function ProblemWorkbench({
  slug,
  initialData,
  isAuthed,
}: {
  slug: string;
  initialData: GetData;
  isAuthed: boolean;
}) {
  const utils = api.useUtils();
  const query = api.practice.get.useQuery({ slug }, { initialData });
  const { problem, mySubmissions, isAdmin } = query.data;

  const [tab, setTab] = useState<Tab>("description");
  const [language, setLanguage] = useState<JudgeLanguage>("CPP");
  // One draft per language, restored from localStorage once on mount. The
  // editor renders client-only (ssr: false), so reading storage in the lazy
  // initializer can't cause a hydration mismatch.
  const [drafts, setDrafts] = useState<Record<JudgeLanguage, string>>(() => {
    if (typeof window === "undefined") return { ...STARTER_TEMPLATES };
    const load = (l: JudgeLanguage) =>
      localStorage.getItem(draftKey(slug, l)) ?? STARTER_TEMPLATES[l];
    return { CPP: load("CPP"), PYTHON: load("PYTHON"), JAVA: load("JAVA") };
  });
  const [result, setResult] = useState<VerdictResult | null>(null);
  const [runResult, setRunResult] = useState<RouterOutputs["practice"]["run"] | null>(null);
  const [lastAction, setLastAction] = useState<"run" | "submit" | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customInput, setCustomInput] = useState("");

  // Draggable split (lg+ only). Percent width of the statement pane.
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftPct, setLeftPct] = useState(46);
  const dragging = useRef(false);

  const code = drafts[language];
  const onCodeChange = (next: string) => {
    setDrafts((d) => ({ ...d, [language]: next }));
    localStorage.setItem(draftKey(slug, language), next);
  };

  const submit = api.practice.submit.useMutation({
    onSuccess: (res) => {
      setResult({ verdict: res.verdict, tests: res.tests, compileOutput: res.compileOutput });
      void utils.practice.get.invalidate({ slug });
      void utils.practice.list.invalidate();
    },
  });

  const run = api.practice.run.useMutation({
    onSuccess: (res) => setRunResult(res),
  });
  const busy = run.isPending || submit.isPending;

  const setStatus = api.practice.setStatus.useMutation({
    onSuccess: () => {
      void utils.practice.get.invalidate({ slug });
      void utils.practice.list.invalidate();
    },
  });

  const statementPane = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[14px] border border-cp-line bg-cp-surface">
      {/* title row */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-cp-line px-4 py-3">
        <h1 className="font-display text-[17px] font-bold tracking-[-0.01em]">{problem.title}</h1>
        <DifficultyBadge difficulty={problem.difficulty} />
        {problem.status === "DRAFT" ? (
          <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-amber-500">
            Draft
          </span>
        ) : null}
        {isAdmin ? (
          <Button
            variant="outline"
            size="xs"
            className="ml-auto"
            disabled={setStatus.isPending}
            onClick={() =>
              setStatus.mutate({
                slug,
                status: problem.status === "DRAFT" ? "PUBLISHED" : "DRAFT",
              })
            }
          >
            {problem.status === "DRAFT" ? "Publish" : "Unpublish"}
          </Button>
        ) : null}
      </div>

      {/* tabs */}
      <div className="flex gap-1 border-b border-cp-line px-2 pt-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-current={tab === t.key}
            className={`relative rounded-t-lg px-3 py-2 text-[13px] transition-colors ${
              tab === t.key ? "font-semibold text-cp-text" : "text-cp-dim hover:text-cp-text"
            }`}
          >
            {t.label}
            {t.key === "submissions" && mySubmissions.length > 0 ? (
              <span className="ml-1.5 rounded-full bg-cp-bg-soft px-1.5 font-mono text-[10px] text-cp-faint">
                {mySubmissions.length}
              </span>
            ) : null}
            {tab === t.key ? (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-cp-accent" />
            ) : null}
          </button>
        ))}
      </div>

      {/* tab content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {tab === "description" ? (
          <>
            <p className="mb-4 font-mono text-[11px] text-cp-faint">
              {problem.timeLimitMs / 1000}s time · {problem.memoryMb}MB memory
              {problem.tags.length > 0 ? ` · ${problem.tags.join(", ")}` : ""}
            </p>
            <Statement statementMd={problem.statementMd} samples={problem.tests} />
          </>
        ) : tab === "editorial" ? (
          <EditorialTab editorialMd={problem.editorialMd} />
        ) : (
          <SubmissionList submissions={mySubmissions} isAuthed={isAuthed} />
        )}
      </div>
    </div>
  );

  const editorPane = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[14px] border border-cp-line bg-cp-surface">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-cp-line px-3 py-2">
        <div className="flex gap-1">
          {LANGUAGE_OPTIONS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => setLanguage(l.value)}
              className={`rounded-lg px-2.5 py-1 font-mono text-[12px] transition-colors ${
                language === l.value
                  ? "bg-cp-accent font-bold text-cp-accent-ink"
                  : "border border-cp-line text-cp-dim hover:text-cp-text"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          title="Reset to template"
          onClick={() => onCodeChange(STARTER_TEMPLATES[language])}
          className="ml-auto grid size-7 place-items-center rounded-lg border border-cp-line text-cp-faint transition-colors hover:text-cp-text"
        >
          <RotateCcw className="size-3.5" />
        </button>
      </div>

      {/* editor */}
      <div className="min-h-[320px] flex-1 lg:min-h-0 [&>div]:h-full">
        <CodeEditor
          language={language}
          value={code}
          onChange={onCodeChange}
          readOnly={!isAuthed}
          height="100%"
          className="h-full"
        />
      </div>

      {/* custom input */}
      {showCustom ? (
        <div className="shrink-0 border-t border-cp-line p-3">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-cp-faint">
            Custom input (used by Run; leave empty to run the samples)
          </div>
          <textarea
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            rows={3}
            spellCheck={false}
            placeholder="stdin for your program…"
            className="w-full resize-y rounded-[8px] border border-cp-line bg-cp-bg-soft px-2.5 py-1.5 font-mono text-[12px] text-cp-text placeholder:text-cp-faint focus:border-cp-accent focus:outline-none"
          />
        </div>
      ) : null}

      {/* results */}
      {(lastAction === "submit" && (result || submit.error)) ||
      (lastAction === "run" && (runResult || run.error)) ? (
        <div className="max-h-[42%] shrink-0 overflow-y-auto border-t border-cp-line p-3">
          {lastAction === "submit" ? (
            submit.error ? (
              <p className="rounded-[10px] border border-cp-line bg-cp-bg-soft px-3.5 py-2.5 text-[13px] text-red-400">
                {submit.error.message}
              </p>
            ) : result ? (
              <VerdictPanel result={result} />
            ) : null
          ) : run.error ? (
            <p className="rounded-[10px] border border-cp-line bg-cp-bg-soft px-3.5 py-2.5 text-[13px] text-red-400">
              {run.error.message}
            </p>
          ) : runResult ? (
            <RunPanel result={runResult} />
          ) : null}
        </div>
      ) : null}

      {/* action bar */}
      <div className="flex flex-wrap items-center gap-2.5 border-t border-cp-line px-3 py-2.5">
        <Button
          variant="outline"
          disabled={!isAuthed || busy || code.trim().length === 0}
          onClick={() => {
            setRunResult(null);
            setLastAction("run");
            run.mutate({
              slug,
              language,
              source: code,
              ...(showCustom && customInput.length > 0 ? { customInput } : {}),
            });
          }}
        >
          {run.isPending ? (
            <>
              <Loader2 className="animate-spin" /> Running…
            </>
          ) : (
            <>
              <FlaskConical /> Run
            </>
          )}
        </Button>
        <Button
          disabled={!isAuthed || busy || code.trim().length === 0}
          onClick={() => {
            setResult(null);
            setLastAction("submit");
            submit.mutate({ slug, language, source: code });
          }}
        >
          {submit.isPending ? (
            <>
              <Loader2 className="animate-spin" /> Judging…
            </>
          ) : (
            <>
              <Play /> Submit
            </>
          )}
        </Button>
        <button
          type="button"
          onClick={() => setShowCustom((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border border-cp-line px-2.5 py-1.5 font-mono text-[11px] transition-colors ${
            showCustom ? "text-cp-text" : "text-cp-faint hover:text-cp-text"
          }`}
        >
          <Terminal className="size-3.5" /> Custom input
        </button>
        {!isAuthed ? (
          <span className="text-[13px] text-cp-dim">Sign in (top right) to run or submit.</span>
        ) : null}
      </div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="flex flex-col gap-3 lg:grid lg:h-full lg:gap-0"
      style={{ gridTemplateColumns: `${leftPct}% 10px minmax(0, 1fr)` }}
    >
      {statementPane}

      {/* draggable divider (lg+) */}
      <div
        role="separator"
        aria-orientation="vertical"
        className="hidden cursor-col-resize items-center justify-center lg:flex"
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!dragging.current || !containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const pct = ((e.clientX - rect.left) / rect.width) * 100;
          setLeftPct(Math.min(68, Math.max(28, pct)));
        }}
        onPointerUp={(e) => {
          dragging.current = false;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
      >
        <div className="h-10 w-1 rounded-full bg-cp-line transition-colors hover:bg-cp-accent" />
      </div>

      {editorPane}
    </div>
  );
}
