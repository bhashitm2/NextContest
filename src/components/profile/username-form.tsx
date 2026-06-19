"use client";

import { Loader2, Pencil } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { validateUsername } from "@/lib/username";
import { api } from "@/trpc/react";

export function UsernameForm({ initialUsername }: { initialUsername: string | null }) {
  const utils = api.useUtils();
  const [editing, setEditing] = useState(!initialUsername);
  const [value, setValue] = useState(initialUsername ?? "");
  const [error, setError] = useState<string | null>(null);

  const save = api.handle.setUsername.useMutation({
    onSuccess: () => {
      setError(null);
      setEditing(false);
      utils.handle.myUsername.invalidate();
    },
    onError: (e) => setError(e.message),
  });

  const current = initialUsername;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const localError = validateUsername(value);
    if (localError) return setError(localError);
    save.mutate({ username: value });
  }

  return (
    <div className="rounded-[14px] border border-cp-line bg-cp-surface p-4 sm:p-5">
      <h2 className="font-display text-[17px] font-bold">Your public profile</h2>
      <p className="mt-1 text-[13px] text-cp-dim">
        Pick a username — your verified stats become a shareable page anyone can view.
      </p>

      {current && !editing ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="font-display text-[26px] font-bold tracking-tight">
            <span className="text-cp-faint">@</span>
            {current}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setValue(current);
              setError(null);
              setEditing(true);
            }}
          >
            <Pencil />
            Edit
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-[10px] border border-cp-line bg-cp-bg pl-3 focus-within:border-cp-accent">
            <span className="font-mono text-[13px] text-cp-faint">/u/</span>
            <input
              value={value}
              onChange={(e) => {
                setValue(e.target.value.toLowerCase());
                setError(null);
              }}
              placeholder="your-handle"
              className="w-44 bg-transparent px-1.5 py-2 font-mono text-[14px] text-cp-text outline-none placeholder:text-cp-faint"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              autoFocus={Boolean(current)}
            />
          </div>
          <Button type="submit" disabled={save.isPending || !value || value === current}>
            {save.isPending ? <Loader2 className="animate-spin" /> : null}
            {current ? "Save" : "Claim"}
          </Button>
          {current ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={save.isPending}
              onClick={() => {
                setValue(current);
                setError(null);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          ) : null}
        </form>
      )}

      {error ? <p className="mt-2 text-[12px] text-destructive">{error}</p> : null}
    </div>
  );
}
