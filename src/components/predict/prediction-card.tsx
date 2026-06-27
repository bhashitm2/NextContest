import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { PlatformLogo } from "@/components/platform-logo";
import type { Platform } from "@/generated/prisma/client";
import { PLATFORM_META, platformColor } from "@/lib/platforms";
import type { ContestPrediction } from "@/server/predictions/types";

const GAIN = "#22c55e";
const LOSS = "#f43f5e";

function deltaColor(d: number): string {
  return d > 0 ? GAIN : d < 0 ? LOSS : "var(--cp-dim)";
}

function signed(n: number): string {
  return `${n > 0 ? "+" : ""}${n}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-cp-line bg-cp-bg px-3 py-2.5">
      <div className="font-mono text-[11px] uppercase tracking-wide text-cp-faint">{label}</div>
      <div className="mt-0.5 font-display text-[20px] font-bold leading-none text-cp-text">
        {value}
      </div>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[14px] border border-dashed border-cp-line bg-cp-surface p-7 text-center">
      <p className="font-display text-[15px] font-semibold text-cp-text">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-[13.5px] text-cp-dim">{body}</p>
    </div>
  );
}

export function PredictionCard({
  prediction,
  platform,
  handle,
}: {
  prediction: ContestPrediction;
  platform: Platform;
  handle: string;
}) {
  const { state } = prediction;
  const platformLabel = PLATFORM_META[platform].label;
  const color = platformColor(platform);

  if (state === "pending") {
    return (
      <Notice
        title="Results aren't in yet"
        body={`This contest just finished — ${platformLabel} hasn't settled the standings. Check back shortly and the prediction will appear.`}
      />
    );
  }
  if (state === "not-participated") {
    return (
      <Notice
        title="No prediction for this contest"
        body={`${handle} isn't in the rated standings for this contest.`}
      />
    );
  }
  if (state === "unavailable" || prediction.predictedDelta == null) {
    return (
      <Notice
        title="Couldn't load a prediction"
        body={`We couldn't fetch the data needed to predict ${handle}'s rating change right now. Please try again in a bit.`}
      />
    );
  }

  const delta = prediction.predictedDelta;
  const isFinal = state === "final";
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;

  return (
    <div
      className="overflow-hidden rounded-[16px] border border-cp-line"
      style={{
        borderLeft: `3px solid ${color}`,
        background: "linear-gradient(165deg, var(--cp-surface2), var(--cp-surface))",
      }}
    >
      <div className="flex items-center justify-between gap-3 px-5 pt-5">
        <span className="inline-flex items-center gap-2 font-mono text-[13px] text-cp-dim">
          <PlatformLogo platform={platform} size={15} color={color} />
          {handle}
        </span>
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={
            isFinal
              ? { background: "color-mix(in srgb, var(--cp-accent) 14%, transparent)", color: "var(--cp-accent)" }
              : { background: `color-mix(in srgb, ${color} 14%, transparent)`, color }
          }
        >
          {isFinal ? "Official result" : "Predicted · live"}
        </span>
      </div>

      <div className="flex items-end justify-center gap-2 px-5 py-6">
        <Icon className="mb-2 size-7" style={{ color: deltaColor(delta) }} />
        <span
          className="font-display text-[56px] font-black leading-none tracking-tight"
          style={{ color: deltaColor(delta) }}
        >
          {signed(delta)}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2.5 px-5 pb-5">
        {prediction.currentRating != null ? (
          <Stat label={isFinal ? "Old rating" : "Current"} value={String(prediction.currentRating)} />
        ) : null}
        {prediction.projectedRating != null ? (
          <Stat label={isFinal ? "New rating" : "Projected"} value={String(prediction.projectedRating)} />
        ) : null}
        {prediction.rank != null ? <Stat label="Rank" value={`#${prediction.rank}`} /> : null}
      </div>

      <p className="border-t border-cp-line px-5 py-3 text-center text-[12px] text-cp-faint">
        {isFinal
          ? `Official ${platformLabel} rating change.`
          : `Predicted from the live standings — not yet official. Updates as ${platformLabel} settles ratings.`}
      </p>
    </div>
  );
}
