import { ImageResponse } from "next/og";

// Generated rather than checked in as a binary: the mark is two chevrons, the
// same glyph the site header draws, so the tab icon and the logo stay in sync.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#3b82f6",
          borderRadius: 34,
        }}
      >
        <svg width="116" height="116" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 7l-5 5 5 5" />
          <path d="M16 7l5 5-5 5" />
        </svg>
      </div>
    ),
    size,
  );
}
