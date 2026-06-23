"use client";

import { Bell, BellRing, Loader2 } from "lucide-react";

import { CONTEST_PLATFORMS, PLATFORM_META, platformColor } from "@/lib/platforms";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/react";

export function FollowBar() {
  const utils = api.useUtils();
  const list = api.subscription.list.useQuery();
  const toggle = api.subscription.toggle.useMutation({
    onSuccess: () => {
      utils.subscription.list.invalidate();
      utils.bookmark.getForUser.invalidate();
    },
  });

  const subscribed = new Set((list.data ?? []).map((s) => s.platform));

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-[14px] border border-cp-line bg-cp-surface px-4 py-3">
      <span className="inline-flex items-center gap-2 text-sm text-cp-dim">
        <BellRing className="size-4 text-cp-accent" />
        Auto-remind me about <span className="font-semibold text-cp-text">every</span> contest on:
      </span>
      <div className="flex flex-wrap gap-2">
        {CONTEST_PLATFORMS.map((p) => {
          const on = subscribed.has(p);
          const color = platformColor(p);
          const pending = toggle.isPending && toggle.variables?.platform === p;
          return (
            <button
              key={p}
              type="button"
              disabled={toggle.isPending}
              onClick={() => toggle.mutate({ platform: p })}
              aria-pressed={on}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-60",
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
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : on ? (
                <BellRing className="size-3.5" />
              ) : (
                <Bell className="size-3.5" />
              )}
              {PLATFORM_META[p].label}
              {on ? <span className="text-[11px] opacity-80">· Following</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
