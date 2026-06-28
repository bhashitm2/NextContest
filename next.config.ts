import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The rating-lookup page moved from /predict to /ratings (label/route/title
      // consistency). Keep old bookmarks and links working.
      { source: "/predict", destination: "/ratings", permanent: true },
    ];
  },
};

export default nextConfig;
