import { Resend } from "resend";

import { formatStart } from "@/lib/format";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.EMAIL_FROM ?? "CP Contest Portal <onboarding@resend.dev>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export type ReminderKind = "24h" | "1h";

export async function sendContestReminder(opts: {
  to: string;
  contestTitle: string;
  contestUrl: string;
  startTime: Date;
  kind: ReminderKind;
}) {
  const when = opts.kind === "24h" ? "in 24 hours" : "in 1 hour";
  const subject = `⏰ ${opts.contestTitle} starts ${when}`;

  const html = `
  <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#111">
    <p style="font-size:14px;color:#666;margin:0 0 4px">CP Contest Portal</p>
    <h1 style="font-size:20px;margin:0 0 12px">A contest you bookmarked starts ${when}</h1>
    <div style="border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin:12px 0">
      <p style="font-weight:600;font-size:16px;margin:0 0 6px">${opts.contestTitle}</p>
      <p style="color:#555;margin:0 0 12px">Starts: ${formatStart(opts.startTime)}</p>
      <a href="${opts.contestUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:9px 14px;border-radius:8px;font-size:14px">Go to contest →</a>
    </div>
    <p style="font-size:12px;color:#888;margin-top:16px">
      You're getting this because you bookmarked this contest on
      <a href="${APP_URL}" style="color:#4f46e5">CP Contest Portal</a>.
    </p>
  </div>`;

  const { error } = await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend: ${error.message}`);
  }
}
