"use client";

import { Check, Copy, Link2, Swords, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Avatar } from "@/components/friends/friend-row";
import { Button } from "@/components/ui/button";
import {
  DUEL_FORMATS,
  DUEL_PRESETS,
  type DuelFormatKey,
  type DuelPreset,
  RATING_MAX,
  RATING_MIN,
  suggestedBand,
} from "@/lib/duel";
import { api } from "@/trpc/react";

const RATING_STEPS: number[] = [];
for (let r = RATING_MIN; r <= RATING_MAX; r += 100) RATING_STEPS.push(r);

/** "New duel" header button + the challenge dialog (portal overlay, like the
 * mobile-nav drawer — the header's backdrop-blur would trap a fixed child). */
export function NewDuelLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button className="h-9" onClick={() => setOpen(true)}>
        <Swords data-icon="inline-start" />
        New duel
      </Button>
      {open ? <NewDuelDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function NewDuelDialog({ onClose }: { onClose: () => void }) {
  const utils = api.useUtils();
  const opponents = api.duel.eligibleOpponents.useQuery();

  const [mode, setMode] = useState<"FRIEND" | "OPEN">("FRIEND");
  const [username, setUsername] = useState<string | null>(null);
  const [format, setFormat] = useState<DuelFormatKey>("TIMED");
  const [preset, setPreset] = useState<DuelPreset>("STANDARD");
  const [band, setBand] = useState<{ min: number; max: number } | null>(null); // null = auto
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const create = api.duel.create.useMutation({
    onSuccess: () => {
      utils.duel.invalidate();
      onClose();
    },
  });
  const createOpen = api.duel.createOpen.useMutation({
    onSuccess: (res) => {
      utils.duel.invalidate();
      setCreatedLink(res.joinUrl);
    },
  });

  // Lock page scroll while open (same as the mobile drawer).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const friends = opponents.data?.friends ?? [];
  const me = opponents.data?.me ?? null;
  const chosen = mode === "FRIEND" ? (friends.find((f) => f.username === username) ?? null) : null;
  const auto = suggestedBand(me?.rating ?? null, chosen?.rating ?? null);
  const min = band?.min ?? auto.min;
  const max = band?.max ?? auto.max;

  const submit = () => {
    if (mode === "OPEN") {
      createOpen.mutate({ format, preset, ratingMin: min, ratingMax: max });
      return;
    }
    if (!username) return;
    create.mutate({ username, format, preset, ratingMin: min, ratingMax: max });
  };

  const copyLink = async () => {
    if (!createdLink) return;
    await navigator.clipboard.writeText(createdLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New duel"
        className="relative max-h-[86vh] w-full max-w-[480px] overflow-y-auto rounded-[16px] border border-cp-line bg-cp-bg p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-[18px] font-bold text-cp-text">New duel</h2>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-[9px] text-cp-dim hover:bg-cp-surface hover:text-cp-text"
          >
            <X className="size-4" />
          </button>
        </div>

        {createdLink ? (
          <>
            <p className="text-[13px] text-cp-dim">
              Your challenge link is live for 24 hours — first player to accept starts the duel.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <input
                readOnly
                value={createdLink}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Challenge link"
                className="min-w-0 flex-1 rounded-[10px] border border-cp-line bg-cp-surface px-2.5 py-2 font-mono text-[12px] text-cp-text focus:outline-none"
              />
              <Button variant="outline" onClick={copyLink}>
                {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <div className="mt-5 flex justify-end">
              <Button onClick={onClose}>Done</Button>
            </div>
          </>
        ) : (
          <>
        {/* Mode */}
        <div className="mb-3 flex gap-1.5 rounded-[11px] border border-cp-line p-1">
          {(
            [
              ["FRIEND", "Friend", Swords],
              ["OPEN", "Open link", Link2],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMode(key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-[8px] px-2 py-1.5 text-[13px] font-semibold transition-colors ${
                mode === key ? "bg-cp-surface text-cp-text" : "text-cp-dim hover:text-cp-text"
              }`}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Opponent */}
        {mode === "OPEN" ? (
          <p className="rounded-[10px] border border-dashed border-cp-line px-3.5 py-3 text-[13px] text-cp-dim">
            {!opponents.isLoading && !me
              ? "You need a verified Codeforces handle to duel — connect one in Settings → Profile Links."
              : "Anyone with the link can accept — they just need a NextContest account and a verified Codeforces handle. Single use, expires in 24h."}
          </p>
        ) : (
          <div className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-cp-faint">
            Opponent
          </div>
        )}
        {mode === "OPEN" ? null : opponents.isLoading ? (
          <p className="py-3 text-[13px] text-cp-dim">Loading friends…</p>
        ) : !me ? (
          <p className="rounded-[10px] border border-dashed border-cp-line px-3.5 py-3 text-[13px] text-cp-dim">
            You need a verified Codeforces handle to duel — connect one in Settings → Profile
            Links.
          </p>
        ) : friends.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-cp-line px-3.5 py-3 text-[13px] text-cp-dim">
            No eligible friends yet — your friend also needs a verified Codeforces handle.
          </p>
        ) : (
          <div className="max-h-[180px] space-y-1.5 overflow-y-auto pr-0.5">
            {friends.map((f) => {
              const selected = f.username === username;
              return (
                <button
                  key={f.username}
                  type="button"
                  onClick={() => setUsername(f.username)}
                  className={`flex w-full items-center gap-2.5 rounded-[11px] border px-3 py-2 text-left transition-colors ${
                    selected
                      ? "border-cp-accent bg-cp-surface"
                      : "border-cp-line hover:border-cp-dim"
                  }`}
                >
                  <Avatar image={f.image} name={f.name} username={f.username} size={30} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-cp-text">
                      {f.name ?? `@${f.username}`}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-cp-dim">
                      {f.handle}
                      {f.rating != null ? ` · ${f.rating}` : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Format */}
        <div className="mb-1.5 mt-4 font-mono text-[11px] uppercase tracking-wide text-cp-faint">
          Format
        </div>
        <div className="space-y-1.5">
          {(Object.keys(DUEL_FORMATS) as DuelFormatKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFormat(key)}
              className={`block w-full rounded-[11px] border px-3 py-2 text-left transition-colors ${
                format === key ? "border-cp-accent bg-cp-surface" : "border-cp-line hover:border-cp-dim"
              }`}
            >
              <span className="block text-[13px] font-semibold text-cp-text">
                {DUEL_FORMATS[key].label}
              </span>
              <span className="block text-[12px] text-cp-dim">{DUEL_FORMATS[key].blurb}</span>
            </button>
          ))}
        </div>

        {/* Preset */}
        <div className="mb-1.5 mt-4 font-mono text-[11px] uppercase tracking-wide text-cp-faint">
          Length
        </div>
        <div className="flex gap-1.5">
          {(Object.keys(DUEL_PRESETS) as DuelPreset[]).map((key) => {
            const p = DUEL_PRESETS[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setPreset(key)}
                className={`flex-1 rounded-[11px] border px-2 py-2 text-center transition-colors ${
                  preset === key ? "border-cp-accent bg-cp-surface" : "border-cp-line hover:border-cp-dim"
                }`}
              >
                <span className="block text-[13px] font-semibold text-cp-text">{p.label}</span>
                <span className="block font-mono text-[11px] text-cp-dim">
                  {p.problemCount} × {p.durationSec / 60}m
                </span>
              </button>
            );
          })}
        </div>

        {/* Rating band */}
        <div className="mb-1.5 mt-4 font-mono text-[11px] uppercase tracking-wide text-cp-faint">
          Problem rating
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label="Minimum rating"
            value={min}
            onChange={(e) => setBand({ min: Number(e.target.value), max })}
            className="flex-1 rounded-[10px] border border-cp-line bg-cp-bg px-2.5 py-2 font-mono text-[13px] text-cp-text focus:outline-none"
          >
            {RATING_STEPS.map((r) => (
              <option key={r} value={r} disabled={r > max}>
                {r}
              </option>
            ))}
          </select>
          <span className="text-cp-faint">–</span>
          <select
            aria-label="Maximum rating"
            value={max}
            onChange={(e) => setBand({ min, max: Number(e.target.value) })}
            className="flex-1 rounded-[10px] border border-cp-line bg-cp-bg px-2.5 py-2 font-mono text-[13px] text-cp-text focus:outline-none"
          >
            {RATING_STEPS.map((r) => (
              <option key={r} value={r} disabled={r < min}>
                {r}
              </option>
            ))}
          </select>
        </div>
        {chosen && band == null ? (
          <p className="mt-1 text-[11px] text-cp-faint">Suggested from your ratings.</p>
        ) : null}

        {create.error || createOpen.error ? (
          <p className="mt-3 text-[13px] text-red-400">
            {create.error?.message ?? createOpen.error?.message}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {mode === "OPEN" ? (
            <Button disabled={!me || createOpen.isPending} onClick={submit}>
              <Link2 data-icon="inline-start" />
              {createOpen.isPending ? "Creating…" : "Create link"}
            </Button>
          ) : (
            <Button disabled={!username || create.isPending} onClick={submit}>
              <Swords data-icon="inline-start" />
              {create.isPending ? "Sending…" : "Send challenge"}
            </Button>
          )}
        </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
