import { NextResponse } from "next/server";

import { runPredictions } from "@/server/predictions/cron";

// Fetching standings + the rated-user list can take a while; allow up to 60s.
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

  const result = await runPredictions();
  return NextResponse.json({ ok: true, ...result });
}

export { handle as GET, handle as POST };
