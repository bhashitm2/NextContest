"use client";

import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { python } from "@codemirror/lang-python";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { useMemo } from "react";

import type { JudgeLanguage } from "@/lib/judge-types";

const LANG_EXTENSION: Record<JudgeLanguage, () => ReturnType<typeof cpp>> = {
  CPP: cpp,
  JAVA: java,
  PYTHON: python,
};

// Chrome colors come from the site's --cp-* variables so the editor follows
// the active theme; token colors are fixed mid-tones readable on both.
const chrome = EditorView.theme({
  "&": {
    backgroundColor: "var(--cp-bg-soft)",
    color: "var(--cp-text)",
    fontSize: "13.5px",
  },
  ".cm-content": { fontFamily: "var(--font-mono, ui-monospace, monospace)", padding: "10px 0" },
  ".cm-gutters": {
    backgroundColor: "var(--cp-bg-soft)",
    color: "var(--cp-faint)",
    border: "none",
    borderRight: "1px solid var(--cp-line)",
  },
  ".cm-activeLine": { backgroundColor: "color-mix(in srgb, var(--cp-accent) 7%, transparent)" },
  ".cm-activeLineGutter": {
    backgroundColor: "color-mix(in srgb, var(--cp-accent) 10%, transparent)",
    color: "var(--cp-dim)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-cursor": { borderLeftColor: "var(--cp-text)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "color-mix(in srgb, var(--cp-accent) 24%, transparent) !important",
  },
});

const highlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: [t.keyword, t.modifier, t.controlKeyword], color: "#c678dd" },
    { tag: [t.string, t.special(t.string)], color: "#98c379" },
    { tag: [t.number, t.bool, t.null], color: "#d19a66" },
    { tag: [t.comment, t.blockComment], color: "var(--cp-faint)", fontStyle: "italic" },
    { tag: [t.typeName, t.className, t.namespace], color: "#e5c07b" },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#61afef" },
    { tag: [t.operator, t.punctuation], color: "var(--cp-dim)" },
    { tag: t.variableName, color: "var(--cp-text)" },
  ]),
);

/** Themed CodeMirror wrapper. Import via next/dynamic (ssr: false) — the
 * editor is ~140KB and only needed on the workbench. */
export default function CodeEditor({
  language,
  value,
  onChange,
  readOnly = false,
  height = "380px",
  className = "",
}: {
  language: JudgeLanguage;
  value: string;
  onChange: (code: string) => void;
  readOnly?: boolean;
  /** CSS height; "100%" fills a sized parent (workbench split view). */
  height?: string;
  className?: string;
}) {
  const extensions = useMemo(() => [LANG_EXTENSION[language](), chrome, highlight], [language]);

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      readOnly={readOnly}
      theme="none"
      height={height}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        autocompletion: false,
        highlightActiveLine: true,
        bracketMatching: true,
        closeBrackets: true,
        indentOnInput: true,
      }}
      className={`overflow-hidden [&_.cm-editor]:bg-transparent ${className}`}
      style={height === "100%" ? { height: "100%" } : undefined}
    />
  );
}
