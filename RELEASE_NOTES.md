# Release Notes

This log captures notable user-facing changes and deployment notes for each production rollout. Add a new section for every GitHub tag/Vercel promotion so we keep a single source of truth for what shipped and how to validate it.

## How to Update

1. Duplicate the template at the end of this document.
2. Replace placeholders with version, date, and impact notes.
3. Link the GitHub pull requests/issues when available.
4. Keep the newest release at the top of the file.

---

## v1.0.0 – 2025-10-27

### Highlights

- Initial public release of the budgeting dashboard with authenticated access.
- Full CSV transaction import flow with merchant aliasing and Yelp autocomplete.
- Cash-flow, category trend, spending calendar, and merchant breakdown charts.
- PWA support with offline caching for the latest budget snapshot.

### Added

- Google OAuth sign-in via NextAuth with Prisma adapter persistence.
- Budget month status badge (Budgeting, On Track, Over) driven by plan vs. actuals.
- Dashboard data pipeline with tunable variance/trend thresholds.
- Service worker integration through `next-pwa`.

### Technical Notes

- Requires Node.js 20+ runtime (Vercel defaults to 20) and PostgreSQL.
- `pnpm build` runs `prisma migrate deploy && next build`; ensure `DATABASE_URL` is set for builds.
- Yelp autocomplete is optional but improves merchant normalization (`YELP_API_KEY`).
- Tests compile to `.tmp/tests` before execution; CI should clean up via `pnpm test:clean`.

### QA Checklist

- ✅ Sign-in with Google and redirect to the dashboard.
- ✅ Import a CSV sample, resolve merchants, and verify normalized transactions.
- ✅ Confirm dashboard charts render with seeded data (forecast, trends, calendar, merchant ring).
- ✅ Offline check: load the dashboard, go offline, and ensure cached summary renders.

### Known Issues / Follow-ups

- Service worker cache should be cleared manually if Prisma schema changes.
- Yelp API quotas may throttle autocomplete in high-volume imports (monitor logs).
- No automated seeding script ships yet; add one before wider onboarding.

---

## Template

```
## vX.Y.Z – YYYY-MM-DD

### Highlights
- ...

### Added
- ...

### Changed
- ...

### Fixed
- ...

### Technical Notes
- ...

### QA Checklist
- [ ] ...

### Known Issues / Follow-ups
- ...
```
