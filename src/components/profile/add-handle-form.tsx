"use client";

import { Loader2, Plus } from "lucide-react";
import { useState } from "react";

import type { Platform } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { PLATFORM_META, platformColor, PROFILE_PLATFORM_LIST } from "@/lib/platforms";
import type { ProfilePlatform } from "@/server/profile-sync";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

export function AddHandleForm({ connected }: { connected: Set<Platform> }) {
  const utils = api.useUtils();
  const available = PROFILE_PLATFORM_LIST.filter((p) => !connected.has(p));
  const [platform, setPlatform] = useState<Platform | null>(available[0] ?? null);
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = api.handle.add.useMutation({
    onSuccess: () => {
      setHandle("");
      setError(null);
      utils.handle.list.invalidate();
    },
    onError: (e) => setError(e.message),
  });

  if (available.length === 0) return null;
  // If the selected platform got connected elsewhere, fall back to first available.
  const selected = platform && available.includes(platform) ? platform : available[0];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!handle.trim() || !selected) return;
    add.mutate({ platform: selected as ProfilePlatform, handle });
  }

  return (
    <div className="rounded-[14px] border border-cp-line bg-cp-surface p-4 sm:p-5">
      <h2 className="font-display text-[17px] font-bold">Connect a handle</h2>
      <p className="mt-1 text-[13px] text-cp-dim">
        Add your username — you&apos;ll verify ownership in the next step.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {available.map((p) => {
          const on = p === selected;
          const color = platformColor(p);
          return (
            <button
              key={p}
              type="button"
              onClick={() => setPlatform(p)}
              aria-pressed={on}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                !on && "border-cp-line text-cp-dim hover:bg-cp-surface2",
              )}
              style={
                on
                  ? {
                      background: `color-mix(in srgb, ${color} 16%, transparent)`,
                      borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
                      color,
                    }
                  : undefined
              }
            >
              {PLATFORM_META[p].label}
            </button>
          );
        })}
      </div>

      <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={handle}
          onChange={(e) => {
            setHandle(e.target.value);
            setError(null);
          }}
          placeholder={`Your ${selected ? PLATFORM_META[selected].label : ""} username`}
          className="min-w-[200px] flex-1 rounded-[10px] border border-cp-line bg-cp-bg px-3 py-2 text-[14px] text-cp-text outline-none focus:border-cp-accent placeholder:text-cp-faint"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <Button type="submit" disabled={add.isPending || !handle.trim()}>
          {add.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          Connect
        </Button>
      </form>

      {error ? <p className="mt-2 text-[12px] text-destructive">{error}</p> : null}
    </div>
  );
}
