"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export const ACCENTS = [
  { name: "Violet", color: "#a78bfa", ink: "#0b0a14" },
  { name: "Emerald", color: "#34d399", ink: "#07120c" },
  { name: "Cyan", color: "#22d3ee", ink: "#04141a" },
  { name: "Amber", color: "#fbbf24", ink: "#1a1304" },
] as const;

function applyAccent(color: string, ink: string) {
  const root = document.documentElement;
  root.style.setProperty("--cp-accent", color);
  root.style.setProperty("--cp-accent-ink", ink);
}

export function AccentPicker() {
  const [active, setActive] = useState<string>("Violet");

  useEffect(() => {
    const saved = localStorage.getItem("cp-accent");
    if (!saved) return;
    const found = ACCENTS.find((a) => a.name === saved);
    if (!found) return;
    applyAccent(found.color, found.ink); // DOM write (external) — fine in effect
    const id = setTimeout(() => setActive(found.name), 0);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="flex items-center gap-1.5 px-1">
      {ACCENTS.map((a) => (
        <button
          key={a.name}
          type="button"
          title={a.name}
          aria-label={`${a.name} accent`}
          onClick={() => {
            setActive(a.name);
            applyAccent(a.color, a.ink);
            localStorage.setItem("cp-accent", a.name);
          }}
          className={cn(
            "size-4 rounded-full transition-transform hover:scale-110",
            active === a.name && "ring-2 ring-offset-2 ring-offset-cp-bg",
          )}
          style={
            {
              background: a.color,
              boxShadow: active === a.name ? `0 0 10px ${a.color}` : undefined,
              "--tw-ring-color": a.color,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
