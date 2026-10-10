import type { MetadataRoute } from "next";

import { absoluteUrl, IS_INDEXABLE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // Preview deployments share their content with production; keeping them out
  // of the index avoids duplicate-content competition with the real site.
  if (!IS_INDEXABLE) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // These already 404 for a signed-out crawler (the pages call notFound()),
      // but naming them keeps Googlebot from spending crawl budget proving it.
      // /duels/join/ holds single-use invite tokens and must never be indexed.
      disallow: [
        "/api/",
        "/duels/join/",
        "/settings",
        "/profile",
        "/friends",
        "/compare/",
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
