# Budget App

Personal budgeting PWA built with Next.js App Router, TailwindCSS, and Prisma/Postgres. Auth is handled by NextAuth (Google). The app caches budget + category data on the client and provides CSV import of transactions with merchant normalization.

## Development

```bash
pnpm install
pnpm dev
```

Other helpful commands:

- `pnpm lint` – runs ESLint (typed rules enabled)
- `pnpm test` – runs Vitest unit suites
- `pnpm prisma studio` – inspect data locally
- `pnpm prisma migrate dev --name <migration>` – create a development migration

## Environment Variables

Create a `.env` file (or configure in Vercel) with:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth credentials for NextAuth |
| `NEXTAUTH_URL` | Base URL for NextAuth callbacks |
| `NEXTAUTH_SECRET` | Secret used by NextAuth |
| `YELP_API_KEY` | Yelp Fusion API key used for merchant autocomplete |
| `YELP_API_URL` | (Optional) Override Yelp autocomplete endpoint |

`postinstall` runs `prisma generate`. The build script executes `prisma migrate deploy && next build --turbopack`, so ensure the database URL is available during builds.

## Database + Prisma

- Run `pnpm prisma migrate dev` during development to evolve the schema.
- Deployment uses `prisma migrate deploy` automatically (see `package.json` scripts).

## CSV Import / Merchant Resolution

- When importing CSVs, merchant names are normalized via existing aliases or Yelp autocomplete.
- If a merchant cannot be resolved, a modal prompts for a canonical name; responses are persisted through the `/api/merchants/resolve` endpoint.

## Budget Status Badge

A responsive `MonthStatusBadge` component surfaces whether the current month is **Budgeting**, **On Track**, or **Over** based on the latest snapshot.

## Testing

- Manual transaction form and merchant normalization utilities have Vitest coverage.
- Run `pnpm test` (tests require the dev dependencies from `package.json`).

## Deployment (Vercel)

1. Create the Vercel project and point it at this repository.
2. Set the environment variables listed above (production secrets, DB URL, Yelp key, etc.).
3. Ensure the production Postgres database is reachable from Vercel.
4. Vercel’s build command (`pnpm build`) runs `prisma migrate deploy` followed by `next build --turbopack`.
5. `postinstall` runs `prisma generate` automatically.
6. After the first deploy, verify OAuth callback URLs, Yelp credentials, and run smoke tests (CSV import, merchant resolutions, status badge).

### Next Steps Checklist

1. Create the Vercel project and connect it to Git.
2. Add environment variables in Vercel (see table above).
3. Provision Postgres and update `DATABASE_URL`.
4. Push to `main` to trigger the first build/deploy.
5. If necessary, run `npx prisma migrate deploy` via Vercel CLI or deployment hook.
6. Update Google OAuth authorized domains/redirects.
7. Confirm Yelp credentials in production.
8. Smoke test the CSV import flow, merchant resolution modal, and month status badge.
9. Configure a custom domain (optional).

