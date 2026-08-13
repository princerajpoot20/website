# Dashboard frontend components
> Created: 2026-05-25 | Updated: 2026-05-25

## What this topic covers

The React components under `components/dashboard/**` that consume `dashboard.json` and render the community dashboard page. Includes the top-level composition, the hot-discussions table with filters and pagination, the good-first-issues section, and the explanatory tip.

## Key files

| File | Role |
|------|------|
| `components/dashboard/Header.tsx` | Page header |
| `components/dashboard/GoodFirstIssues.tsx` | Section that renders the mapped good-first-issues list |
| `components/dashboard/GoodFirstIssuesTip.tsx` | Explanatory tooltip about how the good-first-issues workflow works |
| `components/dashboard/Button.tsx` | Dashboard-specific button variant |
| `components/dashboard/table/Table.tsx` | Main hot-discussions table container |
| `components/dashboard/table/Row.tsx` | Row cell for a single discussion |
| `components/dashboard/table/Filters.tsx` | Author / repo / label / assigned filter controls |
| `components/dashboard/table/Pagination.tsx` | Page navigation for the table |
| `dashboard.json` (root of repo) | Data source — read by the page component |

## How it works

### Composition
The dashboard page reads `dashboard.json` via a build-time import (Next.js resolves the JSON to a static asset). The top-level structure is:

```
DashboardPage
├── Header
├── GoodFirstIssues (with GoodFirstIssuesTip)
└── Table (hot discussions)
    ├── Filters
    ├── Row × N
    └── Pagination
```

### Hot-discussions table (`table/Table.tsx`)
- Receives the `hotDiscussions` array (top 12 from the generator)
- Owns filter state (currently applied author, repo, labels, assigned toggle)
- Owns pagination state (current page)
- Passes filtered + paginated rows to `Row`
- Passes total-count to `Pagination`

### Filters (`table/Filters.tsx`, 133 lines — the biggest component)
- Author / repo dropdowns are built from unique values in the `hotDiscussions` list
- Label filter is multi-select
- Assigned filter is a boolean toggle
- Filter changes update state in the parent `Table` via callback

### Row (`table/Row.tsx`)
Renders a single discussion with:
- Title (link to `resourcePath` on GitHub)
- Author avatar (via GitHub avatar URL derived from author login)
- Repo name
- Labels (as coloured chips)
- Assignment indicator
- Score (may or may not be surfaced depending on the design)

### Good-first-issues (`GoodFirstIssues.tsx`)
- Receives the `goodFirstIssues` array from the JSON
- Groups by `area` for section headers
- Renders each issue with title, repo, author, labels, `isAssigned` badge
- Renders `GoodFirstIssuesTip` alongside to help newcomers

### `GoodFirstIssuesTip.tsx`
A small explanatory card / tooltip. Static content — no data dependency. Describes the good-first-issues workflow, expectations, and how to claim one.

## Configuration

| Prop / const | Purpose |
|---|---|
| Data source | `dashboard.json` at repo root, imported statically |
| Filter defaults | All-off; empty search |
| Page size | Set in `Table.tsx` (typically 10) |

## Common gotchas

- **Data source is at repo root, not `config/`.** Imports must reference `../../dashboard.json` or the alias equivalent. Other config JSONs live under `config/`.
- **`hotDiscussions` is already capped at 12** by the generator. The table's pagination is mostly useful once filters reduce the set, or for future expansion. With only 12 items, pagination often shows a single page.
- **Empty arrays are valid states.** Partial-failure runs of the generator emit `{ hotDiscussions: [], goodFirstIssues: [...] }` (or the reverse). Both components should render a "no data" message.
- **`repo` is prefixed with `asyncapi/`** in the JSON — components can display it as-is.
- **`resourcePath`** is a GitHub-relative path (e.g. `/asyncapi/spec/issues/123`). Prepend `https://github.com` for the full URL.
- **`labels` on hot-discussions** may include area/xxx labels; on good-first-issues they're stripped by the generator. Filter accordingly if area is a filter dimension.
- **No client-side refetch.** The dashboard data is baked at build time. Fresh data requires a Netlify build. The Netlify workflow that opens `regenerate-meetings-and-videos` PRs is the source-of-truth cadence (daily).
- **Score is derived at generation.** Components can sort by score but can't recompute it — the input factors (comment counts, reactions) aren't in the JSON.

## Related topics
- [`data-generation.md`](./data-generation.md) — produces the JSON these components render
- [`hot-discussions-scoring.md`](./hot-discussions-scoring.md) — where the `score` field comes from
- [`good-first-issues.md`](./good-first-issues.md) — where the mapped shape comes from
- `../frontend/README.md` — general Next.js page conventions
- [`README.md`](./README.md) — parent chapter
