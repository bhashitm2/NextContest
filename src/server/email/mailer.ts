import nodemailer, { type Transporter } from "nodemailer";

import type { Platform } from "@/generated/prisma/client";
import { formatDuration, formatStartInZone } from "@/lib/format";
import { PLATFORM_META } from "@/lib/platforms";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export type ReminderKind = "24h" | "1h";

export type ReminderEmailOpts = {
  contestTitle: string;
  contestUrl: string;
  startTime: Date;
  durationSeconds: number;
  platform: Platform;
  /** IANA timezone of the recipient; null → format in UTC. */
  timezone: string | null;
  kind: ReminderKind;
};

const ACCENT = "#4f46e5";

/** Build the reminder email's subject + HTML (pure — no sending, so testable). */
export function buildReminderEmail(opts: ReminderEmailOpts): { subject: string; html: string } {
  const when = opts.kind === "24h" ? "in 24 hours" : "in 1 hour";
  const platformLabel = PLATFORM_META[opts.platform].label;
  const startsAt = formatStartInZone(opts.startTime, opts.timezone ?? "UTC");
  const duration = formatDuration(opts.durationSeconds);

  const subject = `⏰ ${platformLabel}: ${opts.contestTitle} starts ${when}`;

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;color:#111">
    <p style="font-size:13px;color:#888;margin:0 0 4px">NextContest reminder</p>
    <h1 style="font-size:20px;line-height:1.3;margin:0 0 14px">
      Your bookmarked <strong>${platformLabel}</strong> contest starts <strong>${when}</strong>
    </h1>
    <div style="border:1px solid #e5e7eb;border-radius:12px;padding:18px;margin:12px 0">
      <p style="display:inline-block;font-size:12px;font-weight:600;color:${ACCENT};background:#eef2ff;border-radius:999px;padding:3px 10px;margin:0 0 10px">${platformLabel}</p>
      <p style="font-weight:700;font-size:17px;margin:0 0 12px">${opts.contestTitle}</p>
      <table style="font-size:14px;color:#444;margin:0 0 14px;border-collapse:collapse">
        <tr><td style="padding:2px 0;color:#888">Starts</td><td style="padding:2px 0 2px 14px;font-weight:600;color:#111">${startsAt}</td></tr>
        <tr><td style="padding:2px 0;color:#888">Duration</td><td style="padding:2px 0 2px 14px;color:#111">${duration}</td></tr>
      </table>
      <a href="${opts.contestUrl}" style="display:inline-block;background:${ACCENT};color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:600">Open contest →</a>
    </div>
    <p style="font-size:12px;color:#999;margin-top:16px;line-height:1.5">
      Time shown in your saved timezone. You're getting this because you bookmarked this contest on
      <a href="${APP_URL}" style="color:${ACCENT}">NextContest</a>.
    </p>
  </div>`;

  return { subject, html };
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  const user = process.env.GMAIL_USER;
  // Google shows app passwords as "abcd efgh ijkl mnop"; spaces aren't part of it.
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  if (!user || !pass) {
    throw new Error("Email not configured: set GMAIL_USER and GMAIL_APP_PASSWORD");
  }
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return transporter;
}

/** Gmail rewrites the From to the authenticated account, so EMAIL_FROM should
 * use the same address (with an optional display name). */
function fromAddress(): string {
  return process.env.EMAIL_FROM || `NextContest <${process.env.GMAIL_USER}>`;
}

export async function sendContestReminder(opts: ReminderEmailOpts & { to: string }) {
  const { subject, html } = buildReminderEmail(opts);
  await getTransporter().sendMail({
    from: fromAddress(),
    to: opts.to,
    subject,
    html,
  });
}
