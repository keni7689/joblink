"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Briefcase, CheckCircle2, AlertCircle, ExternalLink, Plus, Search, Loader2, Trash2, Trophy } from "lucide-react";

type Job = { id: string; original_url: string; company_name: string; job_title: string; favicon_url: string | null; created_at: string; added_by: string };
type Top = { name: string; link_count: number };

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
function dayLabel(iso: string) {
  const d = new Date(iso), now = new Date(), y = new Date(now.getTime() - 86_400_000);
  if (dayKey(d) === dayKey(now)) return "Today";
  if (dayKey(d) === dayKey(y)) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function Home() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [top, setTop] = useState<Top[]>([]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [company, setCompany] = useState("all");
  const [name, setName] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [asking, setAsking] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    try { const n = localStorage.getItem("joblink_name"); if (n) setName(n); else setAsking(true); } catch { setAsking(true); }
  }, []);
  function saveName() {
    const n = draft.trim().slice(0, 30); if (!n) return;
    try { localStorage.setItem("joblink_name", n); } catch {}
    setName(n); setAsking(false);
  }

  const load = useCallback(async () => {
    try { const r = await fetch("/api/jobs", { cache: "no-store" }); const d = await r.json(); setJobs(d.jobs ?? []); setTop(d.top ?? []); } catch {}
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 10_000); return () => clearInterval(t); }, [load]);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); } }, [toast]);

  async function add() {
    if (!url.trim() || busy) return;
    if (!name) { setAsking(true); return; }
    setBusy(true);
    const r = await fetch("/api/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url, name }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) { setUrl(""); setToast({ ok: true, msg: `Added ${d.job.company_name}` }); load(); }
    else setToast({ ok: false, msg: d.error ?? "Something went wrong." });
  }

  async function remove(j: Job) {
    if (!confirm(`Delete the ${j.company_name} job link?`)) return;
    const r = await fetch(`/api/jobs/${j.id}`, { method: "DELETE" });
    if (r.ok) { setJobs((x) => (x ?? []).filter((i) => i.id !== j.id)); setToast({ ok: true, msg: "Job deleted" }); }
    else setToast({ ok: false, msg: "Could not delete the job." });
  }

  const companies = useMemo(() => [...new Set((jobs ?? []).map((j) => j.company_name))].sort(), [jobs]);
  const shown = useMemo(() => (jobs ?? []).filter((j) =>
    (company === "all" || j.company_name === company) &&
    (`${j.company_name} ${j.job_title}`).toLowerCase().includes(q.toLowerCase())), [jobs, q, company]);
  const groups = useMemo(() => {
    const m = new Map<string, Job[]>();
    shown.forEach((j) => { const l = dayLabel(j.created_at); m.set(l, [...(m.get(l) ?? []), j]); });
    return [...m.entries()];
  }, [shown]);
  const today = (jobs ?? []).filter((j) => dayLabel(j.created_at) === "Today").length;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3 py-6">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight"><Briefcase className="h-5 w-5 text-emerald-600" />JobLink</h1>
          <p className="text-sm text-gray-500">Share opportunities. Grow together.</p>
        </div>
        <div className="flex items-center gap-6 text-sm text-gray-500">
          <span><b className="text-lg text-gray-900">{jobs?.length ?? "–"}</b> shared</span>
          <span><b className="text-lg text-gray-900">{jobs ? today : "–"}</b> today</span>
          {name && <button onClick={() => { setDraft(name); setAsking(true); }} className="text-xs underline decoration-dotted hover:text-gray-900">Posting as {name}</button>}
        </div>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Paste company job vacancy URL here..." inputMode="url"
          className="h-11 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-sm shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
        <button onClick={add} disabled={busy}
          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-700 disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add Job
        </button>
      </div>

      {top.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
          <span className="inline-flex items-center gap-1.5 font-medium"><Trophy className="h-4 w-4 text-amber-500" />Top sharers</span>
          {top.map((t, i) => <span key={t.name} className="text-gray-600"><b className="text-gray-900">{i + 1}. {t.name}</b> {t.link_count}</span>)}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company or job title"
            className="h-9 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-gray-400" />
        </div>
        <select value={company} onChange={(e) => setCompany(e.target.value)} className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm">
          <option value="all">All companies</option>
          {companies.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {jobs === null && <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-200/70" />)}</div>}

      {groups.map(([label, list]) => (
        <section key={label} className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">{label} <span className="font-normal text-gray-400">({list.length})</span></h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((j) => (
              <article key={j.id} className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={j.favicon_url ?? ""} alt="" width={32} height={32} className="h-8 w-8 rounded-md border border-gray-100 bg-gray-50" onError={(e) => ((e.target as HTMLImageElement).style.visibility = "hidden")} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{j.company_name}</p>
                    <p className="line-clamp-2 text-sm text-gray-600">{j.job_title}</p>
                  </div>
                  <button onClick={() => remove(j)} aria-label="Delete job" title="Delete job" className="rounded p-1 text-gray-300 transition hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                  <span className="truncate">by {j.added_by}</span>
                  <a href={j.original_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex shrink-0 items-center gap-1 font-medium text-emerald-700 hover:underline">
                    View Job <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      {jobs && shown.length === 0 && (
        <div className="mt-16 text-center text-sm text-gray-500">
          {jobs.length === 0 ? "No jobs yet. Paste a vacancy link above to share the first one." : "No jobs match your search."}
        </div>
      )}

      {asking && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h2 className="font-semibold">What's your name?</h2>
            <p className="mt-1 text-sm text-gray-500">Shown on the links you share. We only ask once.</p>
            <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveName()} maxLength={30}
              className="mt-3 h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-emerald-500" />
            <div className="mt-3 flex justify-end gap-2">
              {name && <button onClick={() => setAsking(false)} className="h-9 rounded-lg px-3 text-sm text-gray-600 hover:bg-gray-100">Cancel</button>}
              <button onClick={saveName} className="h-9 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-700">Save name</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div role="status" className={`fixed bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-lg px-4 py-2.5 text-sm text-white shadow-lg ${toast.ok ? "bg-emerald-600" : "bg-red-600"}`}>
          {toast.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}{toast.msg}
        </div>
      )}
    </main>
  );
}
