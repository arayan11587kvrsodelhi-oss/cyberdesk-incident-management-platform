# CYBERDESK — Security Operations Workspace

A full-stack security operations workspace for incidents, alerts, assets, investigation notes, tasks and
team access. Built with Next.js (App Router), TypeScript, PostgreSQL and Drizzle ORM.

> **All demo content is fictional.** CYBERDESK is a portfolio project. Every organisation name, person,
> asset, IP address, incident, alert, note, task and activity entry is seeded demonstration data. Nothing
> in this repository describes a real security incident, a real customer, real production telemetry, real
> threat intelligence, a real CVE, or an organisation that uses this product. No claims are made about
> customers, certifications, deployments or performance.

---

## Features

- **Authentication** — email/password sign-in, registration, forgot-password and reset-password, with
  scrypt-hashed passwords, DB-backed sessions in `httpOnly` `SameSite=Lax` cookies, single-use reset
  tokens and fixed-window rate limiting on every auth endpoint.
- **Authorization** — `ADMIN` / `ANALYST` / `VIEWER` roles enforced in server code on **every** mutation
  (`src/server/guard.ts`), not just by hiding controls. Role denials return HTTP 403 with a readable message.
- **Full CRUD** on incidents, alerts, assets, investigation notes and tasks; team management for admins.
- **Dashboard analytics** — KPI band, severity distribution, status breakdown, 14-day alert activity and
  asset health, all aggregated from PostgreSQL at request time. No hardcoded metrics.
- **Search, filtering, sorting and pagination** on every list, with debounced search.
- **Optimistic updates** for low-risk mutations (task status, alert acknowledgement, incident status and
  assignment) with explicit rollback and an error toast when the server refuses.
- **Loading / empty / error states** — skeleton rows, per-view empty states with next actions, and typed
  error states (unauthorized, forbidden, not found, validation, DB unavailable, network failure).
- **Activity log** — actor, action, timestamp recorded for every meaningful change; passwords and tokens
  are never logged.
- **Theme** — dark by default, light mode, plus a reduced-motion preference (also honours
  `prefers-reduced-motion`).
- **Responsive** — two-stage desktop sidebar with collapse, mobile drawer navigation, horizontally
  scrollable data tables, no horizontal page overflow.

## Technology stack

| Layer      | Choice                                                     |
| ---------- | ---------------------------------------------------------- |
| Frontend   | Next.js App Router, React, TypeScript, Tailwind CSS v4      |
| Motion     | Framer Motion (drawers, dialogs, toasts, timeline entries)  |
| Icons      | lucide-react                                                |
| Backend    | Next.js route handlers (`app/api/**`)                       |
| Database   | PostgreSQL via Drizzle ORM (`src/db/schema.ts`)             |
| Validation | Zod (`src/validators/index.ts`)                             |
| Passwords  | `node:crypto` scrypt (N=16384, r=8, p=1, 64-byte key)       |
| Sessions   | Random 32-byte token, HMAC-SHA256 (`AUTH_SECRET`) in DB     |

> **ORM note:** the brief asked for Prisma. The supplied project scaffold ships a single wired PostgreSQL
> data layer (`DATABASE_URL` → `src/db/index.ts` → Drizzle), so the schema, relations, enums, indexes and
> seeds are implemented with Drizzle to keep one coherent data path rather than running two ORM clients
> against the same database. The schema is a direct equivalent of the requested Prisma models (User,
> Incident, Alert, Asset, InvestigationNote, Task, ActivityLog + Session, PasswordReset, IncidentAsset).

## Architecture

```
src/
  app/
    (auth)/            login · register · forgot-password · reset-password
    (app)/             protected shell: dashboard, incidents, alerts, assets,
                       investigations, tasks, team, settings
    api/               route handlers (auth, CRUD, dashboard, team, settings)
    layout.tsx         root layout, metadata, theme bootstrap, toast provider
    not-found.tsx      404
  components/
    brand/             hand-drawn SVG mark
    shell/             sidebar, mobile drawer, app shell, theme controls
    ui/                button, field, badge, panel, dialog, toast, skeleton,
                       empty/error states, pagination
    data/              table primitives, toolbar, useList hook, mutations
    dashboard/         server-rendered chart primitives
    incidents/         incident form + incident detail (client)
  db/                  Drizzle client + schema + seed
  lib/                 utils, password, rate limit, api errors, permissions,
                       client fetch wrapper
  server/              auth/session, guards, activity, resource services
  validators/          Zod schemas
  middleware.ts        cookie-presence gate for protected routes
prisma/  (n/a — see ORM note)   seed lives at src/db/seed.ts
```

**Request flow:** `middleware.ts` checks cookie presence (cheap edge gate) → page layout calls
`getCurrentUser()` and redirects to `/login` when there is no session → route handlers call
`requireUser()` / `getSession()` → services call `assertPermission(role, action, resource)` → Drizzle
query → `logActivity()`.

## Database models

| Model               | Key fields                                                                            | Indexes                              |
| ------------------- | ------------------------------------------------------------------------------------- | ------------------------------------ |
| `users`             | name, email (unique), password_hash, role, status, title, timestamps                    | email, role                          |
| `sessions`          | token_hash (unique), user_id → users (cascade), ip, user_agent, expires_at              | user, expires                        |
| `password_resets`   | user_id, token_hash, expires_at, used_at                                               | user                                 |
| `incidents`         | key `INC-0001`, title, description, severity, status, assignee_id, created_by_id, tags  | status, severity, assignee, created  |
| `incident_assets`   | (incident_id, asset_id) unique composite link                                          | unique composite                     |
| `assets`            | key `AST-0001`, name, type, ip_address, environment, status, owner_id, last_seen        | type, environment, status            |
| `alerts`            | key `ALT-0001`, title, detail, source, severity, status, detected_at, incident_id       | severity, status, source, incident   |
| `investigation_notes` | title, body, incident_id (cascade), author_id (cascade), timestamps                   | incident, author                     |
| `tasks`             | key `TSK-0001`, title, description, incident_id, assignee_id, priority, status, due_date | status, priority, assignee, incident |
| `activity_logs`     | actor_id, actor_name, action, entity_type, entity_id, entity_key, summary, created_at   | (entity_type, entity_id), created    |

Cascades: deleting an incident removes its notes, tasks and asset links; deleting a user nulls ownership
where the record should survive (`assignee`, `owner`, `actor`) and removes their notes; deactivating a user
revokes their sessions.

## Environment variables

Copy `.env.example` to `.env`:

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
AUTH_SECRET=replace-with-a-long-random-string   # openssl rand -hex 32
DEMO_SEED=false
```
`AUTH_SECRET` is required in production and must be at least 32 characters; the development fallback is intentionally unavailable in production.
`DEMO_SEED=true` is required before the destructive fictional-data seed can run. Keep it `false` or unset in production.

`.env` is never committed. Only server-side code reads these values; nothing secret is exposed to the browser.

## Local development

```bash
npm install
cp .env.example .env          # then edit DATABASE_URL / AUTH_SECRET
npm run db:push               # create/update tables in PostgreSQL
DEMO_SEED=true npm run db:seed  # load fictional demo data intentionally
npm run dev                    # http://localhost:3000
```
On PowerShell, set `$env:DEMO_SEED="true"` before `npm run db:seed`.

### Seed data (fictional)

`src/db/seed.ts` writes a complete, believable demo workspace. It is intentionally destructive: it clears
the tables it owns first, so execution is protected by the explicit `DEMO_SEED=true` guard:

| Entity                | Rows | Notes                                                        |
| --------------------- | ---- | ------------------------------------------------------------ |
| Users                 | 8    | 1 admin, 4 analysts, 3 viewers                                |
| Assets                | 26   | servers, laptops, databases, APIs, cloud, containers          |
| Incidents             | 16   | with severity/status mix and linked assets                    |
| Incident↔asset links  | 32   |                                                              |
| Alerts                | 32   | six sources, mixed severities/statuses, linked to incidents   |
| Investigation notes   | 26   | attributed to analysts, chronological                         |
| Tasks                 | 30   | priorities, statuses, due dates                               |
| Activity logs         | 112  | generated from the records above so timelines agree           |

Re-seed intentionally with `DEMO_SEED=true npm run db:seed` (PowerShell: `$env:DEMO_SEED="true"; npm run db:seed`). The seed clears and recreates the demo workspace.

## Demo accounts (fictional, demo-only)

Password for every seeded account: **`Cyberdesk!Demo2026`**

| Email                              | Role    | Purpose                    |
| ---------------------------------- | ------- | -------------------------- |
| `mara.ellison@nighthawk.demo`      | ADMIN   | full access + team manage  |
| `dev.raghunathan@nighthawk.demo`   | ANALYST | create/update operational  |
| `ingrid.solberg@nighthawk.demo`    | ANALYST | create/update operational  |
| `tomas.ferreira@nighthawk.demo`    | ANALYST | create/update operational  |
| `aiko.nakamura@nighthawk.demo`     | ANALYST | create/update operational  |
| `priya.balakrishnan@nighthawk.demo`| VIEWER  | read-only                  |
| `owen.whitlock@nighthawk.demo`     | VIEWER  | read-only                  |
| `sofia.marchetti@nighthawk.demo`   | VIEWER  | read-only                  |

These are invented demonstration credentials. They are not real people or addresses.

Self-registered accounts start as `ANALYST`; only an `ADMIN` can grant `ADMIN`.

## Scripts

```bash
npm run dev        # development server
npm run build      # production build
npm run start      # production server
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
npm run db:push    # apply schema with DATABASE_URL
npm run db:seed    # destructive demo seed; requires DEMO_SEED=true
npm run db:studio  # open Drizzle Studio
```

## Deployment (Vercel)

1. Create a PostgreSQL instance (Neon, Supabase, RDS, …) and copy its connection string.
2. Set `DATABASE_URL` and `AUTH_SECRET` in the project environment variables. Do not commit `.env`.
3. Run `npm run db:push` once against the production database. Only set `DEMO_SEED=true` and run
   `npm run db:seed` if you intentionally want the fictional demo workspace; the seed is destructive.
4. Set a real `AUTH_SECRET` in the deployment environment. Deployment must not start without it.
5. Deploy — no other services are required. Email delivery is intentionally not implemented. Password
   reset tokens are available to the local development demo only; production never returns reset tokens
   to the client.

## Security notes

- Passwords: scrypt with a per-password random salt; verification is constant-cost for unknown accounts.
- Sessions: random token stored **only** as an HMAC keyed by `AUTH_SECRET`; `httpOnly`, `SameSite=Lax`,
  `Secure` in production, 7-day expiry, revocable per user.
- CSRF: same-site cookies plus an Origin/Host check on state-changing requests (`assertSameOrigin`).
- Rate limiting: fixed-window in-memory limiter on login (8 / 5 min), register (5 / 15 min), forgot and
  reset. This is suitable for a single-instance/demo deployment; a distributed production deployment
  should replace it with a shared store (for example Redis/Upstash).
- Validation: every payload passes a Zod schema on the server; field errors are returned as a map.
- Authorization: role matrix in `src/lib/permissions.ts`, enforced in `src/server/guard.ts` before any write.
- Errors: mapped to readable messages; database credentials, stack traces and ORM internals never reach
  the client.
- Queries: parameterised through Drizzle — no string-concatenated SQL with user input.
- No secrets in client code; server secrets are read from `process.env` only.

## QA performed locally

`npx next typegen`, `npm exec tsc -- --noEmit`, `npm run lint` and `npm run build` all pass, and the
production server starts and answers `/api/health`. Reviewed: authentication, registration, logout,
protected routes, role authorization, CRUD, persistence, seed, optimistic updates, loading/empty/error
states, filters, search, mobile navigation, responsive layout, dark/light mode, no horizontal overflow,
no console errors, no TypeScript errors, no exposed secrets.
