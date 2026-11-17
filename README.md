# JobLink

Shared job-link board. Next.js + Supabase + Vercel, all free tier.

## Setup
1. **Supabase**: create a project, open SQL Editor, run `supabase/schema.sql`.
2. Copy `.env.example` to `.env.local`. Fill `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Project Settings > API) and a long random `CRON_SECRET`.
3. `npm install && npm run dev`, open http://localhost:3000.

## Deploy to Vercel
1. Push this folder to GitHub, then import it in Vercel.
2. Add the four env vars from `.env.example` in Project Settings > Environment Variables.
3. Deploy. `vercel.json` registers a daily cron (03:00 UTC) that calls `/api/cron/cleanup`; Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.

## Notes
- Retention: change `RETENTION_DAYS` (default 30).
- Duplicates: `normalized_url` is UNIQUE; the API also handles the race via Postgres error 23505.
- RLS is enabled with no policies, so the public anon key can't read or write. Only server routes use the service role key.
- Live updates use 10-second polling.
- Rate limit is in-memory per serverless instance, so it's a basic spam brake, not a hard guarantee.

## v2 additions
- **Existing database?** Run the `-- v2` block at the end of `supabase/schema.sql` in the Supabase SQL Editor before deploying.
- **Name:** asked once per browser (saved in localStorage); click "Posting as ..." to change it.
- **Top sharers:** stored in the `contributors` table and updated on every successful add. Deleting a link does not reduce the count.
- **Storage cap:** `MAX_JOBS` (default 300). After each add and in the daily cron, the oldest jobs beyond the cap are deleted.
- **Delete:** the trash icon on each card. There is no login, so anyone can delete any link.
