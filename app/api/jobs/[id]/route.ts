import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { rateLimited } from "@/lib/url";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (rateLimited(`del:${ip}`, 20)) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  const { error } = await db().from("jobs").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: "Could not delete the job." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
