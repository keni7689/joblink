import type { SupabaseClient } from "@supabase/supabase-js";
export const maxJobs = () => Number(process.env.MAX_JOBS) || 300;

// Keeps the table under the cap by deleting the oldest rows.
export async function trimOldest(sb: SupabaseClient) {
  const max = maxJobs();
  const { count } = await sb.from("jobs").select("id", { count: "exact", head: true });
  if (!count || count <= max) return 0;
  const { data } = await sb.from("jobs").select("id").order("created_at", { ascending: true }).limit(count - max);
  if (!data?.length) return 0;
  await sb.from("jobs").delete().in("id", data.map((r) => r.id));
  return data.length;
}
