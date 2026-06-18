import { NextResponse } from "next/server";

import { runReminderDispatch } from "@/server/reminders/dispatch";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function handle(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runReminderDispatch();
  return NextResponse.json({ ok: true, ...result });
}

export { handle as GET, handle as POST };
