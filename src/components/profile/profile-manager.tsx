"use client";

import type { Platform } from "@/generated/prisma/client";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/trpc/react";

import { AddHandleForm } from "./add-handle-form";
import { HandleCard } from "./handle-card";
import { UsernameForm } from "./username-form";

export function ProfileManager() {
  const list = api.handle.list.useQuery();
  const username = api.handle.myUsername.useQuery();

  const handles = list.data ?? [];
  const connected = new Set<Platform>(handles.map((h) => h.platform));

  return (
    <div className="space-y-5">
      {username.isLoading ? (
        <Skeleton className="h-32 w-full rounded-[14px]" />
      ) : (
        <UsernameForm initialUsername={username.data?.username ?? null} />
      )}

      <AddHandleForm connected={connected} />

      {list.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full rounded-[14px]" />
          <Skeleton className="h-28 w-full rounded-[14px]" />
        </div>
      ) : handles.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-cp-line bg-cp-surface p-8 text-center text-cp-dim">
          No handles connected yet. Add one above to start building your profile.
        </div>
      ) : (
        <div className="space-y-3">
          {handles.map((h) => (
            <HandleCard key={h.platform} handle={h} />
          ))}
        </div>
      )}
    </div>
  );
}
