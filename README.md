# Fluid End Turnaround System — Phase 1

A from-scratch web app that replaces the paper fluid-end turnaround document with a
**digital turnaround form** and **dual electronic sign-off** (PSI, then the operator),
issuing a tamper-evident **PDF certificate** and keeping a **permanent, searchable
record per fluid end**.

This is the Phase 1 build described in the requirements spec: it covers digital
documentation + dual e-signature. RFID/barcode tracking and Stripe billing are
scoped as later phases and are not built here (the data model already reserves a
`tagId` field for Phase 2).

---

## Quick start (local dev)

Requires a Postgres database. The easiest path is a free **Supabase** project
(the app is designed for it) — or any local Postgres.

```bash
npm install
cp .env.example .env    # fill in DATABASE_URL + DIRECT_URL (see .env.example)
                        # keep STORAGE_DRIVER=local for dev
npm run db:migrate      # apply migrations to your database
npm run db:seed         # load 3 demo turnarounds
npm run dev             # http://localhost:3000
```

Open http://localhost:3000. Three demo turnarounds are seeded (a draft, one
awaiting signature, and a failed-test draft).

## Deploying (Supabase + GitHub + Vercel)

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the full step-by-step runbook.
In short: create a Supabase project + `certificates` storage bucket, push to
GitHub, import into Vercel, and set the environment variables. Each Vercel deploy
runs `prisma generate && prisma migrate deploy && next build`.

---

## The workflow

1. **New turnaround** — capture the unit (serial #, manufacturer, customer),
   the replaced wear parts, and the pressure-test result. A `FluidEnd` record is
   created or matched automatically by serial number.
2. **Send for signatures** — the draft is routed for sign-off (PSI first).
3. **PSI signs** — the technician opens their signing link and adopts an electronic
   signature. Status advances to *Awaiting operator*.
4. **Operator (Pro Petro) signs** — the operator accepts the unit. Both signatures
   now captured with a timestamped audit trail.
5. **Certificate issued** — a signed PDF is generated automatically, the job is
   marked *Completed*, and the certificate is downloadable and attached to the
   unit's permanent history.

Each fluid end accumulates its full turnaround history, retrievable by serial number
under **Fluid Ends**.

---

## E-signature providers (pluggable)

Signing is abstracted behind `lib/esign`. Choose the provider with `ESIGN_PROVIDER`:

- **`mock`** (default) — signing happens inside this app via tokenized links. This
  is the recommended path for the pilot/demo: it exercises the entire dual-signature
  workflow (routing, audit trail, certificate) with no third-party account.
- **`boldsign`** — the production adapter (`lib/esign/boldsign.ts`), wired to
  BoldSign's embedded-signing API. Set `ESIGN_PROVIDER=boldsign` and `BOLDSIGN_API_KEY`
  to switch. No other app code changes.

To go live on BoldSign you'll finalize the embedded-signing link exchange and add a
webhook to mark signatures `SIGNED` on their callback — see the notes in
`lib/esign/boldsign.ts`.

---

## Tech stack

- **Next.js 14 (App Router) + TypeScript** — one deployable full-stack app (Vercel).
- **Prisma + Postgres (Supabase)** — pooled connection at runtime, direct connection
  for migrations. Migrations live in `prisma/migrations/`.
- **Supabase Storage** for certificate PDFs in production (pluggable via
  `lib/storage` — `local` disk in dev, `supabase` bucket in prod, since Vercel's
  filesystem is read-only).
- **pdf-lib** for certificate generation (pure JS, runs server-side).
- **Hand-written CSS** (`app/globals.css`) — no build-tool dependency.

## Data model

| Entity          | Purpose                                                            |
| --------------- | ----------------------------------------------------------------- |
| `FluidEnd`      | The physical unit; permanent record keyed by serial number.       |
| `TurnaroundJob` | One turnaround event (draft → awaiting → completed).              |
| `PressureTest`  | Test result attached to a job (pressure, hold time, pass/fail).   |
| `Signature`     | One sign-off record; two per completed job (PSI + operator).      |

## Project layout

```
app/                     Next.js routes (App Router)
  page.tsx               Dashboard
  jobs/new/page.tsx      New turnaround intake form
  jobs/[id]/page.tsx     Turnaround detail + sign-off
  sign/[token]/page.tsx  Tokenized signing page
  units/                 Fluid-end list + per-unit history
  certificate/[…]/route  Serves generated certificate PDFs
  actions.ts             Server actions (create / send / sign)
lib/
  esign/                 Pluggable e-signature providers (mock, boldsign)
  storage/               Pluggable certificate storage (local, supabase)
  certificate.ts         PDF certificate generator
  db.ts, jobs.ts, constants.ts
prisma/schema.prisma     Data model (Postgres)
prisma/migrations/       Committed migrations (applied on deploy)
scripts/seed.mjs         Demo data
scripts/smoke.mjs        End-to-end smoke test (see below)
DEPLOYMENT.md            Supabase + GitHub + Vercel runbook
```

## Tests

`scripts/smoke.mjs` drives the whole flow in a headless browser (create → send →
PSI sign → operator sign → certificate is a valid PDF). With the app running:

```bash
npx playwright install chromium   # once, if you don't have a browser
node scripts/smoke.mjs            # or: CHROME_EXECUTABLE=/path/to/chrome node scripts/smoke.mjs
```

## Environment variables

See `.env.example`. Key ones:

- `DATABASE_URL` — Supabase **pooled** Postgres URL (runtime).
- `DIRECT_URL` — Supabase **direct** Postgres URL (migrations).
- `STORAGE_DRIVER` — `local` (dev) or `supabase` (prod).
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_CERT_BUCKET` — for `supabase` storage.
- `ESIGN_PROVIDER` — `mock` (default) or `boldsign`.
- `BOLDSIGN_API_KEY` — required only when using BoldSign.
- `APP_BASE_URL` — used to build signing links (your Vercel URL in prod).

---

## Roadmap (from the spec)

- **Phase 1 (this build):** digital turnaround form + dual e-signature + certificate.
- **Phase 2:** RFID / barcode tracking (the `FluidEnd.tagId` field is reserved).
- **Phase 3:** Stripe monthly subscription billing per customer company.
