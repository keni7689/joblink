import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { extractMeta } from "@/lib/meta";
import { maxJobs, trimOldest } from "@/lib/trim";
import { isSafeHost, normalizeUrl, parseHttpUrl, rateLimited } from "@/lib/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const COLS = "id,original_url,company_name,job_title,favicon_url,created_at,added_by";

export async function GET() {
  const sb = db();
  const [jobs, top] = await Promise.all([
    sb.from("jobs").select(COLS).order("created_at", { ascending: false }).limit(maxJobs()),
    sb.from("contributors").select("name,link_count").order("link_count", { ascending: false }).limit(5),
  ]);
  if (jobs.error) return NextResponse.json({ error: "Could not load jobs." }, { status: 500 });
  return NextResponse.json({ jobs: jobs.data, top: top.data ?? [] });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (rateLimited(ip)) return NextResponse.json({ error: "Too many submissions. Try again in a minute." }, { status: 429 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 30) : "";
  if (!name) return NextResponse.json({ error: "Enter your name first." }, { status: 400 });
  const url = typeof body?.url === "string" && body.url.length <= 2048 ? parseHttpUrl(body.url) : null;
  if (!url) return NextResponse.json({ error: "Enter a valid http or https link." }, { status: 400 });
  if (!(await isSafeHost(url.hostname))) return NextResponse.json({ error: "This link can't be added." }, { status: 400 });

  const normalized = normalizeUrl(url);
  const sb = db();
  const dup = { error: "This job link has already been shared!", duplicate: true };
  const { data: existing } = await sb.from("jobs").select("id").eq("normalized_url", normalized).maybeSingle();
  if (existing) return NextResponse.json(dup, { status: 409 });

  const m = await extractMeta(url);
  const { data, error } = await sb.from("jobs").insert({
    original_url: url.toString(), normalized_url: normalized, added_by: name,
    company_name: m.company, job_title: m.title, favicon_url: m.favicon,
  }).select(COLS).single();

  if (error?.code === "23505") return NextResponse.json(dup, { status: 409 });
  if (error) return NextResponse.json({ error: "Could not save the job." }, { status: 500 });

  await sb.rpc("bump_contributor", { p_name: name });
  await trimOldest(sb);
  return NextResponse.json({ job: data }, { status: 201 });
}
