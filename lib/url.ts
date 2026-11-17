import dns from "node:dns/promises";
import net from "node:net";

const TRACKING = /^(utm_.+|fbclid|gclid|msclkid|mc_cid|mc_eid|igshid|ref_src)$/i;

export function parseHttpUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "http:" || u.protocol === "https:" ? u : null;
  } catch { return null; }
}

// Removes only tracking params + fragment; keeps params the job page may need.
export function normalizeUrl(u: URL): string {
  const n = new URL(u.href);
  n.hash = "";
  n.hostname = n.hostname.toLowerCase().replace(/^www\./, "");
  [...n.searchParams.keys()].forEach((k) => TRACKING.test(k) && n.searchParams.delete(k));
  n.searchParams.sort();
  if (n.pathname.length > 1) n.pathname = n.pathname.replace(/\/+$/, "");
  return n.toString();
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return isPrivateIp(v.slice(7));
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") ||
    v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb");
}

export async function isSafeHost(host: string): Promise<boolean> {
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (net.isIP(host)) return !isPrivateIp(host);
  try {
    const addrs = await dns.lookup(host, { all: true });
    return addrs.length > 0 && addrs.every((a) => !isPrivateIp(a.address));
  } catch { return false; }
}

const hits = new Map<string, number[]>();
// Best-effort in-memory limiter (per serverless instance): 8 adds / minute / IP.
export function rateLimited(ip: string, max = 8, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > max;
}
