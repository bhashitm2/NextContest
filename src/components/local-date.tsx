"use client";

import { useEffect, useState } from "react";

import { formatStart, formatStartInZone } from "@/lib/format";

/**
 * Renders an absolute date/time in the viewer's local timezone & locale.
 *
 * The server can't know the viewer's timezone, so it renders the time in UTC
 * and we re-format to local after mount. Server and first client render both
 * produce the same UTC string, so there is no hydration mismatch.
 *
 * This used to render a bare "—" until the effect ran, which meant every
 * contest date was absent from the server HTML — a contest calendar whose dates
 * are invisible to crawlers can't rank for "when is <contest>". The <time>
 * element gives machines the unambiguous ISO value regardless.
 */
export function LocalDate({ date, className }: { date: Date; className?: string }) {
  const [text, setText] = useState(() => formatStartInZone(date, "UTC"));

  useEffect(() => {
    const id = setTimeout(() => setText(formatStart(date)), 0);
    return () => clearTimeout(id);
  }, [date]);

  return (
    <time dateTime={date.toISOString()} className={className} suppressHydrationWarning>
      {text}
    </time>
  );
}
