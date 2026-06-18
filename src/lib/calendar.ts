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

/** A single-event .ics document, including a 1-hour-before reminder. */
export function buildIcs(c: CalendarContest): string {
  const uid = `${c.platform ?? "cp"}-${c.externalId ?? toICSDate(c.startTime)}@cpcontestportal`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CP Contest Portal//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(c.startTime)}`,
    `DTEND:${toICSDate(c.endTime)}`,
    `SUMMARY:${escapeICS(c.title)}`,
    `DESCRIPTION:${escapeICS(`Contest link: ${c.url}`)}`,
    `URL:${c.url}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeICS(`${c.title} starts in 1 hour`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/** Suggested filename for a downloaded .ics. */
export function icsFilename(c: CalendarContest): string {
  return `${(c.platform ?? "contest").toLowerCase()}-${c.externalId ?? "event"}.ics`;
}
