import { isSafeHost, parseHttpUrl } from "./url";

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

function metaTag(html: string, key: string): string | null {
  for (const tag of html.match(/<meta[^>]+>/gi) ?? []) {
    if (new RegExp(`(property|name)=["']${key}["']`, "i").test(tag)) {
      const c = tag.match(/content=["']([^"']*)["']/i);
      if (c?.[1]) return decode(c[1]);
    }
  }
  return null;
}

async function fetchHtml(url: URL): Promise<string | null> {
  let cur = url;
  for (let hop = 0; hop < 3; hop++) {
    if (!(await isSafeHost(cur.hostname))) return null;
    const res = await fetch(cur, {
      redirect: "manual",
      signal: AbortSignal.timeout(5000),
      headers: { "user-agent": "JobLinkBot/1.0", accept: "text/html" },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      const next = loc ? parseHttpUrl(new URL(loc, cur).href) : null;
      if (!next) return null;
      cur = next; continue;
    }
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html") || !res.body) return null;
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    while (size < 300_000) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value); size += value.length;
    }
    reader.cancel().catch(() => {});
    return Buffer.concat(chunks).toString("utf8");
  }
  return null;
}

export async function extractMeta(url: URL) {
  const host = url.hostname.replace(/^www\./, "");
  const parts = host.split(".");
  const base = parts.length > 2 && parts[parts.length - 2].length <= 3 ? parts[parts.length - 3] : parts[Math.max(0, parts.length - 2)];
  let company = base.charAt(0).toUpperCase() + base.slice(1);
  let title = "Job Opportunity";
  try {
    const html = await fetchHtml(url);
    if (html) {
      const site = metaTag(html, "og:site_name");
      if (site && site.length < 60) company = site;
      const t = metaTag(html, "og:title") ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
      if (t) title = decode(t).slice(0, 140) || title;
    }
  } catch { /* fall back to domain + generic title */ }
  return { company, title, favicon: `https://www.google.com/s2/favicons?domain=${host}&sz=64` };
}
