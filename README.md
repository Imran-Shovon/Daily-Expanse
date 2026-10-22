# Daily Expense Tracker

A full-stack personal finance app: track income and expenses, set budgets, automate recurring transactions and explore reports. Each user only ever sees their own data.

Use the বাংলা / English button beside the theme control to switch the interface language, including dates, amounts and reports. The preference is saved in your browser and is also available on sign-in pages. Names, notes and other user-entered content stay as entered.

| Layer | Stack |
| --- | --- |
| Frontend (`apps/web`) | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui-style components on Radix, TanStack Query, React Hook Form + Zod, Recharts, Lucide |
| Backend (`apps/api`) | NestJS 11, Prisma 6, PostgreSQL 17, JWT access tokens + rotating httpOnly refresh cookies, bcrypt, class-validator, Swagger, `@nestjs/schedule`, `@nestjs/throttler` |
| Shared (`packages/shared`) | Enums, constants and API response types used by both apps |
| Tooling | pnpm workspaces, Turborepo, ESLint, Prettier, Jest, Docker Compose |

```
expense-tracker/
├── apps/
│   ├── api/                 NestJS REST API (prisma/ holds schema, migrations, seed)
│   └── web/                 Next.js frontend
├── packages/shared/         Shared types & constants
├── docker/postgres/init/    Creates the test database on first start
├── docker-compose.yml
├── turbo.json
└── package.json
```

## Quick start

Prerequisites: **Node.js 20.11+**, **pnpm 10+** (`corepack enable`), **Docker**.

```bash
# 1. Install dependencies (also generates the Prisma client)
pnpm install

# 2. Environment files
cp .env.example .env                    # docker compose (Postgres credentials)
cp apps/api/.env.example apps/api/.env  # API config: set real JWT secrets!
cp apps/web/.env.example apps/web/.env  # where Next.js proxies /api/v1

# 3. Start PostgreSQL
pnpm db:up

# 4. Apply migrations and load the demo account
pnpm db:migrate        # prisma migrate dev
pnpm db:seed           # demo@example.com / Demo1234

# 5. Run API + web in watch mode
pnpm dev
```

Open http://localhost:3000. API: http://localhost:4000/api/v1, Swagger: http://localhost:4000/api/docs.

Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

> **Ports busy?** Change `PORT` and `WEB_URL` in `apps/api/.env`, `API_URL` in `apps/web/.env`, and run the web app with `PORT=xxxx pnpm --filter @expense/web dev`. On Windows, Hyper-V can reserve port ranges (`netsh int ipv4 show excludedportrange protocol=tcp`).

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | API (`nest start --watch`) and web (`next dev`) together |
| `pnpm build` | Production builds of all packages |
| `pnpm lint` / `pnpm typecheck` | ESLint / TypeScript across the monorepo |
| `pnpm test` | Unit tests (API Jest + web `node --test`) |
| `pnpm test:e2e` | API integration tests against the real test database |
| `pnpm db:up` / `pnpm db:down` | Start / stop PostgreSQL |
| `pnpm db:migrate` | Create & apply migrations in development |
| `pnpm db:deploy` | Apply migrations in production (`prisma migrate deploy`) |
| `pnpm db:seed` | Re-create the demo user with ~4 months of data |
| `pnpm db:studio` | Prisma Studio |
| `pnpm format` | Prettier |

### Production

```bash
pnpm build
pnpm db:deploy
pnpm --filter @expense/api start        # node dist/main.js
pnpm --filter @expense/web start        # next start (set API_URL before building)
```

Or run everything in containers:

```bash
docker compose --profile app up --build   # db + api (:4000) + web (:3000)
```

The API container runs `prisma migrate deploy` on start. `API_URL` for the web image is a build argument because Next.js resolves rewrites at build time.

### Vercel

The app deploys to Vercel as **one project with two [Services](https://vercel.com/docs/services)** (Beta), configured in `vercel.json`:

- `web`: the Next.js app (`apps/web`), serving every path except the API.
- `api`: a Node.js function (`apps/server/api/index.js`) that serves the compiled NestJS app (`apps/api/src/serverless.ts`) for `/api/v1/*` and `/api/docs`. The API is built with `nest build`, which keeps the decorator metadata Nest needs. A wrapper package is used so Vercel doesn't apply its NestJS preset, which can't follow pnpm's linked `node_modules`.
- Both share one domain, so the refresh cookie stays first-party.
- The build runs `prisma migrate deploy` against `DATABASE_URL_UNPOOLED`.
- A daily Vercel Cron calls `GET /api/v1/internal/cron/recurring` with `Authorization: Bearer $CRON_SECRET`. Due recurring transactions are also processed when a user opens the dashboard. Set `RECURRING_SCHEDULER_ENABLED=false` on Vercel, since serverless functions can't run the in-process scheduler.

Required project environment variables: `DATABASE_URL` and `DATABASE_URL_UNPOOLED` (injected by the Neon Marketplace integration), `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CRON_SECRET`, `COOKIE_SECURE=true`, `RECURRING_SCHEDULER_ENABLED=false`, `WEB_URL` and `API_URL` (the production URL), and `ENABLE_EXPERIMENTAL_COREPACK=1` (to use the pnpm version from `packageManager`).

```bash
vercel deploy          # preview
vercel deploy --prod   # production
```

## Environment variables

### `apps/api/.env`

| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `production` or `test` |
| `PORT` | `4000` | API port |
| `DATABASE_URL` | – | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | – | ≥ 32 chars; signs access tokens |
| `JWT_REFRESH_SECRET` | – | ≥ 32 chars, different from the access secret; HMAC key for refresh/reset token hashes |
| `JWT_ACCESS_TTL` | `900` | Access-token lifetime (seconds) |
| `JWT_REFRESH_TTL_DAYS` | `30` | Refresh-token lifetime (days) |
| `WEB_URL` | `http://localhost:3000` | Frontend origin (CORS, links in emails) |
| `API_URL` | `http://localhost:4000` | Public API URL |
| `COOKIE_SECURE` | `false` | Set `true` behind HTTPS |
| `TRUST_PROXY` | `1` | Reverse proxies in front of the API (Next.js counts as one) |
| `RECURRING_SCHEDULER_ENABLED` | `true` | In-process scheduler for recurring transactions |
| `SWAGGER_ENABLED` | `true` | Serve `/api/docs` |
| `GOOGLE_CLIENT_ID` | – | Google sign-in OAuth client ID. With the secret set, "Continue with Google" appears on the sign-in pages |
| `GOOGLE_CLIENT_SECRET` | – | Google sign-in OAuth client secret |

#### Google sign-in

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), configure the OAuth consent screen (External, scopes `openid`, `email`, `profile`), then create an **OAuth client ID** of type **Web application**.
2. Add an **Authorized redirect URI** for every place the app runs: `WEB_URL` + `/api/v1/auth/google/callback`, e.g. `http://localhost:3000/api/v1/auth/google/callback` and `https://your-domain/api/v1/auth/google/callback`.
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (locally in `apps/api/.env`, on Vercel as project environment variables) and restart or redeploy.

While the consent screen is in **Testing**, only the test users you list can sign in; publish it to open sign-in to everyone. A Google sign-in links to an existing account with the same verified email; accounts created through Google have no password until the user sets one in Settings.

`apps/api/.env.test` (same keys) points `DATABASE_URL` at `expense_tracker_test`; the integration tests refuse to run against any database without `test` in its URL.

### `apps/web/.env`

| Variable | Description |
| --- | --- |
| `API_URL` | Server-side only. Where Next.js proxies `/api/v1/*`. Never exposed to the browser. |

Never commit real `.env` files; only the `*.example` files are tracked.

## API

All routes are under `/api/v1` and documented in Swagger at `/api/docs` (click **Authorize** and paste the `accessToken` from `POST /auth/login`).

- **Auth**: `POST auth/register | login | refresh | logout | forgot-password | reset-password`, `GET auth/me`
- **Users**: `GET | PATCH | DELETE users/me`, `PATCH users/me/password`
- **Transactions**: `GET | POST transactions`, `GET | PATCH | DELETE transactions/:id`. Query: `page`, `pageSize` (≤ 100), `search`, `type`, `categoryId`, `paymentMethod`, `tag`, `range` or `from`/`to`, `sortBy` (`date|amount|title|createdAt`), `sortOrder`
- **Categories**: `GET | POST categories`, `PATCH | DELETE categories/:id` (`?reassignTo=` moves transactions before deleting a category in use)
- **Budgets**: `GET | POST budgets` (`?date=` picks the period), `PATCH | DELETE budgets/:id`
- **Dashboard**: `GET dashboard/summary | spending-trends | category-breakdown`
- **Reports**: `GET reports/transactions | income-expenses | export` (CSV)
- **Recurring**: `GET | POST recurring-transactions`, `GET | PATCH | DELETE recurring-transactions/:id`, `POST :id/pause | :id/resume`, `GET :id/executions`, `POST recurring-transactions/process`
- **Health**: `GET health`

Date-range parameters: `range=today|this_week|this_month|last_month|this_year`, or `from=YYYY-MM-DD&to=YYYY-MM-DD`. If omitted, the user's default range applies. Errors always look like `{ statusCode, error, message, details?, path, timestamp }`.

## Design decisions

**Money.** Stored as `NUMERIC(14,2)`, summed in SQL, combined with decimal.js (`Prisma.Decimal`) and sent over the wire as strings such as `"84.20"`. JavaScript numbers are only used to plot charts. Amounts are validated as positive with at most two decimals. The currency setting controls display only; there is no conversion.

**Dates and time zones.** Transaction, budget and schedule dates are calendar dates (`DATE`) belonging to the user. "Today", "this week" (Monday-based) and "this month" are resolved in the user's IANA time zone, so a Dhaka user at 01:00 local time sees the correct day. Ranges are inclusive on both ends.

**Financial rules** (`apps/api/src/common/finance/calculations.ts`, unit tested):
- Income totals count only `INCOME` and expense totals only `EXPENSE`. **Net for period** = income − expenses.
- **Running balance** is cumulative income − expenses for all recorded history up to the end of the range. It is labelled separately and never presented as a bank balance.
- **Savings rate** = net ÷ income × 100 when income > 0, otherwise shown as "—".
- **Budget utilisation** = qualifying expenses in the budget's current period ÷ budget amount × 100. Warning at ≥ 80%, exceeded above 100%. Budgets never alter balances, and income never counts against them.
- Budget periods are anchored to the budget's start date (a monthly budget starting on the 15th runs 15th–14th). Two budgets of the same scope and period cannot overlap.

**Authentication and security.**
- Access tokens are 15-minute JWTs (HS256), kept in memory on the client, never in `localStorage`.
- Refresh tokens are opaque random values in an `httpOnly`, `SameSite=Strict` cookie scoped to `/api/v1/auth`. Only an HMAC of each token is stored. They rotate on every use, and replaying an already-rotated token revokes the whole session family; a 10-second grace window avoids false positives when two tabs refresh at once. The client also serialises refreshes across tabs with the Web Locks API and shares one in-flight refresh between concurrent requests.
- The browser talks only to the Next.js origin, which proxies `/api/v1` to the API, so cookies are first-party. Cookie-authenticated endpoints (`refresh`, `logout`) also require an `x-csrf-protection: 1` header. A cross-site form can't set it, and a cross-origin fetch that does is blocked by CORS preflight.
- Passwords are hashed with bcrypt (cost 12). Login returns the same error and takes similar time whether or not the email exists, and forgot-password always returns the same response. Reset tokens expire after 30 minutes and are single-use.
- Changing or resetting a password revokes refresh tokens. Changing the email requires the current password, and deleting the account requires the password plus typing `DELETE`; it cascades to all of the user's data.
- Every query is scoped by the user id from the verified token; ids in the body or query are never trusted. Other users' records return 404.
- Global `ValidationPipe` with `whitelist` + `forbidNonWhitelisted`, Helmet, CORS restricted to `WEB_URL`, and rate limits on sensitive routes (login 10/min, register 5/min, forgot-password 5/15 min, …).
- Request logs contain only method, path, status and duration. Prisma query logging is off.
- CSV exports neutralise spreadsheet formulas (cells starting with `= + - @`).

**Recurring transactions.** Each generated occurrence inserts a `RecurringExecution` row, unique on `(recurringTransactionId, scheduledDate)`, in the same database transaction as the new `Transaction`. Retries, overlapping cron runs or several API replicas therefore can't create duplicates; the integration tests check this, including concurrent runs. The scheduler runs every 10 minutes and at startup, and catches up on missed dates (up to 500 per schedule per run). Monthly schedules on the 31st clamp to the month's end without drifting. Resuming a paused schedule skips the dates missed while it was paused. Deleting a schedule keeps the transactions it already created.

**Categories.** 12 expense and 6 income categories are seeded per user at registration. A category still used by transactions or schedules can only be deleted with `reassignTo`, which moves them atomically. The type of a category in use can't be changed, and a transaction's category must match its type.

## Testing

```bash
pnpm test        # 45 API unit tests + 6 web unit tests
pnpm test:e2e    # 48 API integration tests (needs `pnpm db:up`)
```

- **Unit**: date math and time zones, preset ranges, money rounding and float safety, totals, savings rate, budget thresholds and period anchoring, trend bucketing (no double counting), recurrence (month-end, intervals, end dates), CSV escaping, web formatters.
- **Integration** (full Nest app + PostgreSQL): registration, login, guards, refresh rotation and reuse detection, CSRF header, logout, password reset (including expiry and single use), profile, password change, account deletion; transaction CRUD, validation, pagination, filters, search, sorting and inclusive date boundaries; **data isolation** between users; category rules and reassignment; budget usage, warnings and overlap prevention; dashboard summaries, breakdowns and trends; report totals; CSV export; recurring generation and **duplicate prevention under concurrency**.

## Known limitations

- **No email delivery.** Password-reset emails are printed to the API console in development (`MailService`). Production needs an SMTP or API provider added in `MailService.deliver`.
- **Single currency per user**, with no conversion, and no opening-balance setting. The running balance starts from the first recorded transaction.
- **Recurring scheduler** runs in process. It is safe on multiple replicas, but for large deployments a dedicated worker (`RECURRING_SCHEDULER_ENABLED=false` on web replicas) is cleaner.
- **Rate limits** are in memory and per instance. Multi-instance deployments should use a shared store such as Redis.
- **Tags** are stored as a PostgreSQL text array on the transaction rather than a separate table. This is simple and indexable enough for personal use.
- There are no browser end-to-end tests in the repo. The UI was verified manually with a scripted browser walkthrough.
