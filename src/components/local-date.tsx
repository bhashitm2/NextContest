"use client";

import { useEffect, useState } from "react";

import { formatStart } from "@/lib/format";

/**
 * Renders an absolute date/time in the viewer's local timezone & locale.
 * The server can't know the viewer's timezone, so we format only after mount —
 * both server and first client render show the same placeholder, avoiding a
 * hydration mismatch.
 */
export function LocalDate({ date, className }: { date: Date; className?: string }) {
  const [text, setText] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setText(formatStart(date)), 0);
    return () => clearTimeout(id);
  }, [date]);

  return (
    <span className={className} suppressHydrationWarning>
      {text || "—"}
    </span>
  );
}
