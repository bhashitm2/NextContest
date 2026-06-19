type CalendarContest = {
  title: string;
  url: string;
  startTime: Date;
  endTime: Date;
  platform?: string;
  externalId?: string;
};

/** Date → iCalendar UTC stamp, e.g. 20260621T143000Z. */
function toICSDate(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/** Escape text for an iCalendar value (commas, semicolons, backslashes, newlines). */
function escapeICS(s: string): string {
  return s.replace(/([,;\\])/g, "\\$1").replace(/\r?\n/g, "\\n");
}

/** Google Calendar "add event" deep link. */
export function googleCalendarUrl(c: CalendarContest): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: c.title,
    dates: `${toICSDate(c.startTime)}/${toICSDate(c.endTime)}`,
    details: `Contest link: ${c.url}`,
    location: c.url,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Per-event alarm preferences (which "alarm" rings before the contest). */
export type CalendarAlarms = { notify24h?: boolean; notify1h?: boolean };

function icsUid(c: CalendarContest): string {
  return `${c.platform ?? "cp"}-${c.externalId ?? toICSDate(c.startTime)}@nextcontest`;
}

/** One VEVENT (with VALARMs) for a contest. Lines only — no VCALENDAR wrapper.
 * `cancelled` emits a STATUS:CANCELLED tombstone (same UID, higher SEQUENCE) so
 * subscribed calendars remove a contest the user un-followed. */
function icsEvent(c: CalendarContest, opts: CalendarAlarms & { cancelled?: boolean } = {}): string[] {
  if (opts.cancelled) {
    return [
      "BEGIN:VEVENT",
      `UID:${icsUid(c)}`,
      `DTSTAMP:${toICSDate(new Date())}`,
      `DTSTART:${toICSDate(c.startTime)}`,
      `DTEND:${toICSDate(c.endTime)}`,
      `SUMMARY:${escapeICS(c.title)}`,
      "STATUS:CANCELLED",
      "SEQUENCE:2",
      "END:VEVENT",
    ];
  }

  // Default to a 1-hour alarm when no preference is given (matches buildIcs).
  const want24h = opts.notify24h ?? false;
  const want1h = opts.notify1h ?? true;

  const valarm = (trigger: string, label: string) => [
    "BEGIN:VALARM",
    `TRIGGER:${trigger}`,
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeICS(label)}`,
    "END:VALARM",
  ];

  return [
    "BEGIN:VEVENT",
    `UID:${icsUid(c)}`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(c.startTime)}`,
    `DTEND:${toICSDate(c.endTime)}`,
    `SUMMARY:${escapeICS(c.title)}`,
    `DESCRIPTION:${escapeICS(`Contest link: ${c.url}`)}`,
    `URL:${c.url}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    ...(want24h ? valarm("-P1D", `${c.title} starts in 24 hours`) : []),
    ...(want1h ? valarm("-PT1H", `${c.title} starts in 1 hour`) : []),
    "END:VEVENT",
  ];
}

/** A single-event .ics document, including a 1-hour-before reminder. */
export function buildIcs(c: CalendarContest): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NextContest//EN",
    "CALSCALE:GREGORIAN",
    ...icsEvent(c),
    "END:VCALENDAR",
  ].join("\r\n");
}

/** A multi-event subscribable calendar feed. Calendar apps re-fetch this URL
 * periodically, so newly-followed contests appear automatically — each with its
 * own alarm before the contest starts. */
export function buildCalendarFeed(
  events: Array<CalendarContest & CalendarAlarms & { cancelled?: boolean }>,
  opts: { name?: string } = {},
): string {
  const name = opts.name ?? "NextContest";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NextContest//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICS(name)}`,
    "X-WR-CALDESC:Upcoming competitive programming contests you follow on NextContest",
    // Hint to clients how often to re-sync (Apple/Outlook honour these).
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
    ...events.flatMap((e) => icsEvent(e, e)),
    "END:VCALENDAR",
  ].join("\r\n");
}

/** Suggested filename for a downloaded .ics. */
export function icsFilename(c: CalendarContest): string {
  return `${(c.platform ?? "contest").toLowerCase()}-${c.externalId ?? "event"}.ics`;
}
