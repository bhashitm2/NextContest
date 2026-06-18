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
