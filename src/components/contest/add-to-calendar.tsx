"use client";

import { CalendarPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { Contest } from "@/generated/prisma/client";
import { buildIcs, googleCalendarUrl, icsFilename } from "@/lib/calendar";

export function AddToCalendar({ contest }: { contest: Contest }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const downloadIcs = () => {
    const blob = new Blob([buildIcs(contest)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = icsFilename(contest);
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Add to calendar"
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-cp-line-strong bg-cp-surface px-3.5 text-[13px] font-semibold text-cp-dim transition-colors hover:text-cp-text"
      >
        <CalendarPlus className="size-[15px]" />
        <span className="hidden sm:inline">Calendar</span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute bottom-full right-0 z-30 mb-1.5 w-44 overflow-hidden rounded-[10px] border border-cp-line-strong p-1 shadow-xl"
          style={{ background: "var(--cp-bg-soft)" }}
        >
          <a
            role="menuitem"
            href={googleCalendarUrl(contest)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="block rounded-md px-2.5 py-2 text-[13px] text-cp-text transition-colors hover:bg-cp-surface"
          >
            Google Calendar
          </a>
          <button
            role="menuitem"
            type="button"
            onClick={downloadIcs}
            className="block w-full rounded-md px-2.5 py-2 text-left text-[13px] text-cp-text transition-colors hover:bg-cp-surface"
          >
            Download .ics
          </button>
        </div>
      ) : null}
    </div>
  );
}
