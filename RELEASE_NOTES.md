# Release Notes

## v1.0.1 – 2025-10-28

### Highlights

- Retired the client cache layer so budgets, rules, and transactions always reflect real-time data without manual refreshes.
- Dashboard now hydrates from server-provided data instead of a prefilled cache snapshot.
- Use formatCurrency in EnvelopePlanStackedBars to ensure consistency on the format.
- Fix issue of import transactions not overrwriting manual ones
- Address styling issues on mobile
- Update various button to have icons

### Changed

- Replaced the `CacheProvider` context and related hooks with direct API helpers for budgets and categories.
- Updated budget, rules, and transaction flows to fetch and persist data through the new helpers and local component state.
- Dashboard charts receive their dataset as props from the server layout.
- Instead of outputing the raw value in EnvelopePlanStackedBars for the renderCustomizedLabel. It's now passed through the formatCurrency function to ensure correct format.
- Update the routes to link closer with the data recieved from the import

### Fixed

- Eliminated stale UI states that previously required browser refreshes after edits.
- Bar chart not being visible on mobile
- Number on bar chart not being visable
- Manual transaction being overwritten by import.

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
