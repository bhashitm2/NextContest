import type { Metadata } from "next";

import { PredictLookup } from "@/components/predict/predict-lookup";

export const metadata: Metadata = {
  title: "Rating Lookup — NextContest",
  description:
    "Search any Codeforces or LeetCode handle to see their recent contests and rating changes — including a live prediction for a round that isn't rated yet.",
};

export default function PredictPage() {
  return (
    <main className="mx-auto w-full max-w-[560px] px-4 py-10 sm:px-[22px]">
      <header className="mb-6">
        <h1 className="font-display text-[clamp(1.7rem,3.4vw,2.4rem)] font-bold tracking-[-0.02em]">
          Rating Lookup
        </h1>
        <p className="mt-1.5 text-[15px] text-cp-dim">
          Search any Codeforces or LeetCode handle to see their recent contests and rating change
          for each — including a live prediction for a round that isn&apos;t rated yet.
        </p>
      </header>

      <PredictLookup />
    </main>
  );
}
