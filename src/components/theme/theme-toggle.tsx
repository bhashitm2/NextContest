"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(id);
  }, []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title="Toggle theme"
      aria-label="Toggle theme"
      className="grid size-9 place-items-center rounded-[9px] border border-cp-line bg-cp-surface text-cp-dim transition-colors hover:text-cp-text"
    >
      {mounted && !isDark ? <Moon className="size-[17px]" /> : <Sun className="size-[17px]" />}
    </button>
  );
}
