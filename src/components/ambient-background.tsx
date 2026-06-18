/** Fixed dotted-grid backdrop + two slowly drifting glow orbs. */
export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* dotted grid */}
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--cp-text) 8%, transparent) 1px, transparent 0)",
          backgroundSize: "34px 34px",
        }}
      />
      {/* accent orb */}
      <div
        className="absolute -left-[120px] -top-[180px] size-[520px] rounded-full opacity-50"
        style={{
          background: "color-mix(in srgb, var(--cp-accent) 22%, transparent)",
          filter: "blur(150px)",
          animation: "drift 22s ease-in-out infinite",
        }}
      />
      {/* indigo orb */}
      <div
        className="absolute -bottom-[220px] -right-[140px] size-[560px] rounded-full"
        style={{
          background: "color-mix(in srgb, #6366f1 30%, transparent)",
          filter: "blur(160px)",
          opacity: 0.32,
          animation: "drift 28s ease-in-out infinite reverse",
        }}
      />
    </div>
  );
}
