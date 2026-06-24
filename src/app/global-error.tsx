"use client";

import { useEffect } from "react";

import "./globals.css";

/** Last-resort boundary for errors thrown in the ROOT layout itself. It replaces
 * the layout entirely, so it must render its own <html>/<body>. Styled with inline
 * values (hardcoded brand dark palette) so it's bulletproof even if CSS fails. */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#08090c",
          color: "#f3f5f8",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <main style={{ maxWidth: 460, padding: "2rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 700, margin: "0 0 0.5rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#9aa2af", lineHeight: 1.5, margin: "0 0 1.5rem" }}>
            A critical error occurred while loading NextContest. Please try again.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              height: 40,
              padding: "0 18px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(255,255,255,0.04)",
              color: "#f3f5f8",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
