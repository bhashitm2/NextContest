import { ImageResponse } from "next/og";

// Root OG card: inherited by every route that doesn't define its own, so a
// share of /, /contests, /practice or a profile stops rendering as a bare link.
export const alt = "NextContest — every upcoming coding contest in one live feed";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#08090c";
const TEXT = "#e8ecf4";
const DIM = "#8b95a8";
const ACCENT = "#3b82f6";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: BG,
          color: TEXT,
          padding: "0 80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 40 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: 16,
              background: ACCENT,
            }}
          >
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 7l-5 5 5 5" />
              <path d="M16 7l5 5-5 5" />
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: 36, fontWeight: 700 }}>NextContest</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", fontSize: 68, fontWeight: 700, lineHeight: 1.1 }}>
          <div style={{ display: "flex" }}>Every coding contest.</div>
          <div style={{ display: "flex" }}>Every platform.</div>
          <div style={{ display: "flex", color: ACCENT }}>One live feed.</div>
        </div>

        <div style={{ display: "flex", fontSize: 28, color: DIM, marginTop: 40 }}>
          Codeforces · LeetCode · AtCoder · CodeChef
        </div>
      </div>
    ),
    size,
  );
}
