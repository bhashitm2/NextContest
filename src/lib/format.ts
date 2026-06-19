/** "2h 15m", "1h", "45m", "2d 3h" — human-friendly duration from seconds. */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;

  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (mins && !days) parts.push(`${mins}m`);
  return parts.join(" ") || "0m";
}

/** A compact countdown like "2d 04:09:55" / "04:09:55" / "Started". */
export function formatCountdown(msUntil: number): string {
  if (msUntil <= 0) return "Started";
  const totalSeconds = Math.floor(msUntil / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? `${days}d ${clock}` : clock;
}

const DATE_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** "Sat, Jun 21, 01:00 PM" in the viewer's local timezone. */
export function formatStart(date: Date): string {
  return DATE_FMT.format(date);
}

// Friendly abbreviations for common zones; unmapped zones fall back to the
// Intl short name (e.g. "GMT+5:30"). Used for server-rendered emails, which
// can't rely on the browser's local timezone.
const TZ_ABBREV: Record<string, string> = {
  "Asia/Kolkata": "IST",
  "Asia/Calcutta": "IST",
  "America/New_York": "ET",
  "America/Chicago": "CT",
  "America/Denver": "MT",
  "America/Los_Angeles": "PT",
  "Europe/London": "UK time",
  "Europe/Paris": "CET",
  "Europe/Berlin": "CET",
  "Asia/Tokyo": "JST",
  "Asia/Shanghai": "CST",
  "Asia/Singapore": "SGT",
  "Australia/Sydney": "AET",
  UTC: "UTC",
};

function shortZoneName(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(date);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

/** "Sat, Jun 20, 8:00 PM (IST)" — absolute time rendered in a specific IANA
 * timezone, with a friendly label. Falls back to UTC for an invalid zone. */
export function formatStartInZone(date: Date, timeZone: string): string {
  let base: string;
  try {
    base = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    return formatStartInZone(date, "UTC");
  }
  const abbrev = TZ_ABBREV[timeZone] ?? shortZoneName(date, timeZone);
  return `${base} (${abbrev})`;
}
