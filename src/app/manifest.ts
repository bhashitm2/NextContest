import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NextContest — Upcoming Coding Contests",
    short_name: "NextContest",
    description:
      "Every upcoming Codeforces, LeetCode, AtCoder and CodeChef contest in one live feed.",
    start_url: "/contests",
    display: "standalone",
    background_color: "#08090c",
    theme_color: "#08090c",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png" }],
  };
}
