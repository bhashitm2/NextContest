"use client";

import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { PlatformLogo } from "@/components/platform-logo";
import type { Platform } from "@/generated/prisma/client";
import type { RatingForecast } from "@/lib/rating-forecast";
import { platformColor } from "@/lib/platforms";
import { api } from "@/trpc/react";

const GAIN = "#22c55e";
const LOSS = "#f43f5e";

function Row({
  platform,
  handle,
  forecast,
}: {
  platform: Platform;
  handle: string;
  forecast: RatingForecast;
}) {
  const color = platformColor(platform);
  const d = forecast.expectedDelta ?? 0;
  const Icon = forecast.trend === "up" ? TrendingUp : forecast.trend === "down" ? TrendingDown : Minus;
  const tint = d > 0 ? GAIN : d < 0 ? LOSS : "var(--cp-dim)";

  return (
    <div className="flex items-center gap-3 rounded-[12px] border border-cp-line bg-cp-bg px-3.5 py-3">
      <PlatformLogo platform={platform} size={18} color={color} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-[12px] text-cp-dim">{handle}</div>
        <div className="text-[12px] text-cp-faint">
          {forecast.currentRating != null ? (
            <>
              now {forecast.currentRating}
              {forecast.projectedRating != null ? (
                <>
                  {" → ~"}
                  {forecast.projectedRating}
                  {forecast.volatility ? ` (±${forecast.volatility})` : ""}
                </>
              ) : null}
            </>
          ) : (
            `${forecast.sampleSize} contests`
          )}
        </div>
      </div>
      <span className="inline-flex items-center gap-1 font-display text-[15px] font-bold" style={{ color: tint }}>
        <Icon className="size-4" />
        {d > 0 ? "+" : ""}
        {d}
      </span>
    </div>
  );
}

export function ForecastCard({ username }: { username?: string }) {
  const q = api.rating.forecast.useQuery(username ? { username } : undefined);
  const data = q.data ?? [];
  if (data.length === 0) return null;

  return (
    <section className="rounded-[16px] border border-cp-line bg-cp-surface p-5">
      <h2 className="mb-1 font-display text-[15px] font-semibold text-cp-text">Rating trend</h2>
      <p className="mb-3.5 text-[12.5px] text-cp-faint">
        Projected next-contest move from recent form — a rough trend, not a contest prediction.
      </p>
      <div className="space-y-2">
        {data.map((f) => (
          <Row key={`${f.platform}-${f.handle}`} platform={f.platform} handle={f.handle} forecast={f.forecast} />
        ))}
      </div>
    </section>
  );
}
