# Deployment — Supabase + GitHub + Vercel

This guide takes the Phase 1 app from your machine to a live URL. Order matters:
**Supabase first** (database + storage), **GitHub** next (code), **Vercel** last (hosting).

Estimated time: ~20 minutes.

---

## 1. Supabase — database + storage

1. Create a project at https://supabase.com (pick a region close to your users).
   Save the database password you set.
2. **Get the connection strings.** In the dashboard: **Connect** (top bar) → *ORMs* /
   *Prisma*, or **Project Settings → Database**. You need two:
   - **Pooled** (Transaction pooler, port **6543**) → this is your `DATABASE_URL`.
     Append `?pgbouncer=true&connection_limit=1`.
   - **Direct / Session** (port **5432**) → this is your `DIRECT_URL`.

   They look like:
   ```
   DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
   DIRECT_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   ```
3. **Create the storage bucket for certificates.** Storage → **New bucket** →
   name it `certificates` → keep it **Private** (the app serves PDFs through
   short-lived signed URLs). No RLS policy is needed because the server uses the
   service-role key, which bypasses RLS.
4. **Get the storage keys.** Project Settings → **API**:
   - `SUPABASE_URL` = your Project URL (`https://<ref>.supabase.co`)
   - `SUPABASE_SERVICE_ROLE_KEY` = the **service_role** secret
     ⚠️ Server-side only. Never expose it to the browser or commit it.

### Apply the database schema

From your machine, with `.env` filled in (see below), run:

```bash
npm install
npm run db:deploy      # applies prisma/migrations to Supabase (uses DIRECT_URL)
npm run db:seed        # optional: loads demo turnarounds
```

`db:deploy` runs `prisma migrate deploy`. The initial migration in
`prisma/migrations/` creates all four tables.

---

## 2. GitHub — push the code

```bash
git init
git add .
git commit -m "Fluid End Turnaround — Phase 1"
git branch -M main
git remote add origin https://github.com/<you>/fluid-end-turnaround.git
git push -u origin main
```

`.gitignore` already excludes `.env`, `node_modules`, `.next`, and generated PDFs,
so no secrets are committed. The `prisma/migrations/` folder **is** committed — Vercel
needs it to run migrations on deploy.

---

## 3. Vercel — host it

1. https://vercel.com → **Add New → Project** → import your GitHub repo.
   Vercel auto-detects Next.js. Leave the framework preset as-is.
2. **Environment variables** (Project → Settings → Environment Variables). Add these
   for **Production** (and Preview if you want preview deploys to work):

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | Supabase pooled URL (`:6543`, with `?pgbouncer=true&connection_limit=1`) |
   | `DIRECT_URL` | Supabase direct URL (`:5432`) |
   | `STORAGE_DRIVER` | `supabase` |
   | `SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role secret |
   | `SUPABASE_CERT_BUCKET` | `certificates` |
   | `ESIGN_PROVIDER` | `mock` (or `boldsign`) |
   | `BOLDSIGN_API_KEY` | only if using BoldSign |
   | `APP_BASE_URL` | your Vercel URL, e.g. `https://fluid-end-turnaround.vercel.app` |

3. **Deploy.** The build command (from `package.json`) is
   `prisma generate && prisma migrate deploy && next build` — so each deploy
   generates the client, applies any new migrations to Supabase, then builds.
4. After the first deploy, copy the live URL and set `APP_BASE_URL` to it, then
   redeploy so signing links use the real domain.

That's it — open the Vercel URL and you have the live app.

---

## Local development against Supabase

You can point local dev at the same Supabase project (or a second "dev" project):

```bash
cp .env.example .env     # fill in DATABASE_URL + DIRECT_URL from Supabase
# keep STORAGE_DRIVER=local for dev so you don't need storage keys locally
npm install
npm run db:migrate       # create/apply migrations against your dev DB
npm run db:seed
npm run dev
```

---

## Notes & gotchas

- **Pooled vs direct URL matters.** Prisma runs queries over the pooled URL
  (`DATABASE_URL`) and migrations over the direct URL (`DIRECT_URL`). Using the
  direct URL for runtime on serverless will exhaust connections; using the pooled
  URL for migrations fails. Keep them as specified.
- **`connection_limit=1`** on the pooled URL is the recommended setting for
  serverless (each function instance opens minimal connections).
- **Certificates** are private in Supabase Storage and served via 60-second signed
  URLs through `/certificate/[jobNumber]`. Nothing is stored on Vercel's disk.
- **No auth yet.** The app is currently open to anyone with the URL. Before real use,
  add authentication (Supabase Auth integrates cleanly) — this is the recommended
  next step.
- **Migrations on deploy:** if you prefer not to run `migrate deploy` during the
  Vercel build, remove it from the `build` script and run `npm run db:deploy`
  manually (or from CI) instead.
