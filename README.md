# Budget App

Budgeting PWA tailored for tracking cash flow, category plans, and spending trends. The app runs on the Next.js App Router with Prisma/Postgres, provides Google-based authentication via NextAuth, and supports rich dashboards fed by CSV imports and merchant normalization.

## Key Features

- Budget hub showing month status, variance alerts, and snapshot badges.
- Cash-flow forecast, spending calendar, heatmaps, and merchant breakdown charts (Recharts).
- CSV transaction import with alias resolution, Yelp-powered autocomplete, and manual overrides.
- PWA experience via `next-pwa`, including offline caching of the latest budget snapshot.
- Roleless Google OAuth sign-in (NextAuth) with Prisma adapter for persistence.

## Technology Stack

- Next.js 15 App Router with React 19 and TypeScript.
- Tailwind CSS v4 and Headless UI for responsive UI primitives.
- Prisma ORM with PostgreSQL backing (local dev + production).
- Vitest + Node test runner for component and utility suites.
- pnpm for package and workspace management.

## Getting Started

### Prerequisites

- Node.js 20+ (18+ works but Vercel defaults to 20).
- pnpm 8+ (`npm install -g pnpm` if needed).
- Locally reachable PostgreSQL database.
- Yelp Fusion API key for merchant autocomplete (optional but recommended).

### Installation

```bash
pnpm install
```

### Environment Variables

Create `.env` locally (or configure secrets in Vercel) with:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string used by Prisma |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth credentials for NextAuth |
| `NEXTAUTH_URL` | Base URL for NextAuth callbacks (e.g. `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | Secret used to sign NextAuth sessions |
| `YELP_API_KEY` | Yelp Fusion API key for merchant autocomplete |
| `YELP_API_URL` | Optional override for the Yelp autocomplete endpoint |

The `postinstall` hook runs `prisma generate`. Build scripts execute `prisma migrate deploy && next build`, so ensure `DATABASE_URL` is available during builds (local and CI/CD).

### Database Setup

```bash
pnpm prisma migrate dev --name init
pnpm prisma db seed # add a seed script if/when available
```

`pnpm prisma studio` opens Prisma Studio for quick data inspection.

### Local Development

```bash
pnpm dev        # start Next.js in development mode
pnpm lint       # run ESLint (typed rules enabled)
pnpm test       # compile test bundle and execute Node test suites
```

Transactions imported in development persist to your configured Postgres database. Run `pnpm prisma migrate dev` whenever you evolve the schema.

## CSV Imports & Merchant Resolution

- Upload CSV exports from your bank to seed transactions.
- Merchant names are normalized against saved aliases; unresolved entries trigger a modal that records a canonical name via `/api/merchants/resolve`.
- Yelp autocomplete improves suggestions when `YELP_API_KEY` is provided. Without a key, manual aliasing still works.
- The importer highlights unsupported columns and produces a diff so you can confirm changes before applying them.

## Dashboards & Insights

- `DashboardCharts` combines cash-flow forecasts, category trends, spending calendar, and merchant spend distributions.
- Variance thresholds and trend detection settings are centralized in `app/(protected)/dashboard/data.ts` for easier tuning.
- The `MonthStatusBadge` flags the current month as **Budgeting**, **On Track**, or **Over** once actuals are compared against plan.

## Project Structure

- `app/` – Next.js App Router routes (`(protected)/dashboard` contains authenticated views).
- `components/` – Shared UI, including chart visualizations under `components/charts`.
- `lib/` – Prisma client, transaction helpers, and shared utilities.
- `prisma/` – Prisma schema and migration history.
- `types/` – TypeScript declaration files (augments NextAuth session typing).

## Deployment (Vercel)

1. Create a Vercel project and connect this repository.
2. Configure environment variables in the Vercel dashboard (production secrets, Postgres URL, Yelp API key).
3. Provision a production Postgres database accessible from Vercel.
4. Push to `main` to trigger the build (`pnpm build` runs `prisma migrate deploy` followed by `next build`).
5. After the first deploy, verify Google OAuth redirect URIs, Yelp credentials, and smoke test CSV import + merchant resolution in production.
6. Optionally configure a custom domain and rerun smoke tests after DNS cutover.

## Release Workflow

- New releases are tagged in GitHub and deployed via Vercel.
- Update `RELEASE_NOTES.md` with a new section for each version (see initial `v1.0.0` entry).
- Recommended cadence:
  1. Land changes on `main`.
  2. Draft the next release entry.
  3. Tag the commit (`git tag vX.Y.Z && git push origin vX.Y.Z`).
  4. Publish the GitHub Release and verify the Vercel deployment.

## Troubleshooting

- **Build fails because Prisma cannot reach the database** – ensure `DATABASE_URL` is set for the relevant environment (Vercel “Build & Development Settings”).
- **OAuth callback errors** – check `NEXTAUTH_URL`, Google OAuth redirect URIs, and Vercel domain settings.
- **Yelp API quota or timeout** – double-check the API key; set `YELP_API_URL` if using a proxy.
- **Offline caching issues** – clear the service worker (`chrome://serviceworker-internals`) after schema changes that affect cached assets.

## License

This project is licensed under the terms of the included `LICENSE`.
