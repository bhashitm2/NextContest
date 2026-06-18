import { NextResponse } from "next/server";

import { runAllSyncs } from "@/server/sync/run";

// External API fetches can take a while; allow up to 60s.
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

  const results = await runAllSyncs();
  const ok = results.every((r) => r.ok);
  // 207 Multi-Status if some sources failed but others succeeded.
  return NextResponse.json({ ok, results }, { status: ok ? 200 : 207 });
}

export { handle as GET, handle as POST };
