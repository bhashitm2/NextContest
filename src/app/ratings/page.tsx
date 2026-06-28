import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { PredictLookup } from "@/components/predict/predict-lookup";

export const metadata: Metadata = {
  title: "Ratings — NextContest",
  description:
    "Search any Codeforces or LeetCode handle to see their recent contests and rating changes — including a live prediction for a round that isn't rated yet.",
};

export default function RatingsPage() {
  return (
    <main className="mx-auto w-full max-w-[560px] px-4 py-10 sm:px-[22px]">
      <PageHeader
        title="Ratings"
        subtitle="Search any Codeforces or LeetCode handle to see their recent contests and rating change for each — including a live prediction for a round that isn't rated yet."
      />

      <PredictLookup />
    </main>
  );
}
