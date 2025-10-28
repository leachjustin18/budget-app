# Release Notes

## v1.0.1 – 2025-10-28

### Highlights

- Retired the client cache layer so budgets, rules, and transactions always reflect real-time data without manual refreshes.
- Dashboard now hydrates from server-provided data instead of a prefilled cache snapshot.
- Use formatCurrency in EnvelopePlanStackedBars to ensure consistency on the format.

### Changed

- Replaced the `CacheProvider` context and related hooks with direct API helpers for budgets and categories.
- Updated budget, rules, and transaction flows to fetch and persist data through the new helpers and local component state.
- Dashboard charts receive their dataset as props from the server layout.
- Instead of outputing the raw value in EnvelopePlanStackedBars for the renderCustomizedLabel. It's now passed through the formatCurrency function to ensure correct format.

### Removed

- Removed the service worker/PWA setup (`next-pwa`, Workbox assets, and `sw.js`) along with all hydration/cache helpers.

### Fixed

- Eliminated stale UI states that previously required browser refreshes after edits.

### Technical Notes

- New utilities live under `lib/api/` and `lib/types/`; use them for any future data access.
- Run `pnpm install` if tooling complains about dependency changes after pulling.

### Known Issues / Follow-ups

- Evaluate future offline support separately if it returns to the roadmap.
- Updating an exsiting rule doesn't save properly

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

### Known Issues / Follow-ups

- Updating an exsiting rule doesn't save properly
