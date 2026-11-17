import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { trimOldest } from "@/lib/trim";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const days = Number(process.env.RETENTION_DAYS) || 30;
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const sb = db();
  const { error, count } = await sb.from("jobs").delete({ count: "exact" }).lt("created_at", cutoff);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const trimmed = await trimOldest(sb);
  return NextResponse.json({ deleted: count, trimmed, olderThanDays: days });
}
