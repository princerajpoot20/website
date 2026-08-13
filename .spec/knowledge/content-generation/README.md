# Content Generation — Chapter Overview
> Created: 2026-05-25 | Updated: 2026-05-25

## What this chapter covers

All build-time and workflow-invoked scripts under `scripts/` that produce content JSON consumed by the frontend. This includes documentation, blog, RSS, tools, meetings, videos, case studies, finance, use-cases, and markdown-quality checks. Every generator writes into `config/` (with a couple of exceptions like `public/rss.xml`).

Read this chapter for any task that:
- Modifies a `scripts/*.ts` file (not tests)
- Changes the shape of a generated `config/*.json` file
- Adds a new generator or a new npm `generate:*` script
- Investigates why the site is missing or displaying stale content

For the workflows that invoke these scripts on a schedule, see the [`workflows`](../workflows/README.md) chapter. For the dashboard generator specifically (it's complex enough to warrant its own chapter), see [`dashboard`](../dashboard/README.md).

## Key files

| File | Role |
|------|------|
| `scripts/index.ts` | Master orchestrator called at `next build` time (invokes post-list, RSS, casestudies, tools-manual, usecases, finance in sequence) |
| `scripts/build-post-list.ts` | Walks MDX under `pages/docs`, `pages/blog`, `pages/about`; parses front-matter, builds `config/posts.json` with the docs navigation tree |
| `scripts/build-docs.ts` | Helpers: `buildNavTree` (constructs the docs sidebar hierarchy) and `addDocButtons` (adds next/prev nav) — called from `build-post-list.ts` |
| `scripts/build-rss.ts` | Consumes `config/posts.json`, filters/sorts blog posts, produces `public/rss.xml` |
| `scripts/build-tools.ts` | Two entry points: `buildTools` (fetch + combine, workflow-invoked) and `buildToolsManual` (build-time re-combine). See [`tools/README.md`](./tools/README.md). |
| `scripts/build-meetings.ts` | Fetches events from Google Calendar; writes `config/meetings.json` |
| `scripts/build-newsroom-videos.ts` | Fetches recent uploads from YouTube channel; writes `config/newsroom_videos.json` |
| `scripts/build-pages.ts` | Non-MDX page metadata |
| `scripts/casestudies/index.ts` | Reads YAML case study files from a directory; writes `config/case-studies.json` |
| `scripts/finance/index.ts` | Reads YAML `Expenses.yml` / `ExpensesLink.yml` for the latest year; writes `config/finance/json-data/` |
| `scripts/usecases/index.ts` | Compiles the use-cases list |
| `scripts/markdown/check-markdown.ts` | Validates front-matter of docs and blog MDX files |
| `scripts/markdown/check-edit-links.ts` | Sends HEAD requests to every "edit this page" URL in `edit-page-config.json`; flags 404s |
| `scripts/helpers/` | Shared logger, HTTP utilities, JSON I/O, locale checker |

## Topics in this chapter

| Topic | Covers |
|-------|--------|
| [`tools/README.md`](./tools/README.md) | **Sub-chapter.** Tools directory pipeline. Six topic pages covering fetch, validation, combining, tags, output files. |
| [`posts-and-navigation.md`](./posts-and-navigation.md) | How `build-post-list.ts` walks the MDX tree, extracts front-matter, and builds the docs navigation hierarchy (`buildNavTree` + `addDocButtons`). |
| [`rss-feed.md`](./rss-feed.md) | How `build-rss.ts` produces `public/rss.xml` from `config/posts.json`. |
| [`casestudies-finance-usecases.md`](./casestudies-finance-usecases.md) | Three smaller generators: case studies, finance (yearly expenses), and use cases. |
| [`markdown-quality.md`](./markdown-quality.md) | The two `scripts/markdown/*` validators: front-matter validation and edit-link 404 checking. |
| [`meetings-and-videos.md`](./meetings-and-videos.md) | `build-meetings.ts` (Google Calendar → meetings.json) and `build-newsroom-videos.ts` (YouTube → newsroom_videos.json). |

## Patterns

Every generator follows one of two shapes:

**External-source generator** (tools, meetings, videos, dashboard):
```typescript
async function build(writePath) {
  const rawData = await fetchExternalAPI();
  const transformed = transform(rawData);
  await fs.writeFile(writePath, JSON.stringify(transformed, null, 2));
}
```

**Filesystem-walker generator** (posts, casestudies, finance):
```typescript
async function build(inputDir, writePath) {
  const files = await readdir(inputDir);
  const parsed = await Promise.all(files.map(async f => parse(await readFile(f))));
  await fs.writeFile(writePath, JSON.stringify(parsed, null, 2));
}
```

## Common gotchas

- **Tests mirror the source layout.** `scripts/build-X.ts` has `tests/build-X.test.ts`. Same rule for nested directories (`scripts/tools/foo.ts` → `tests/tools/foo.test.ts`).
- **`scripts/index.ts` runs at `next build` time** — anything expensive here slows local `npm run build`.
- **`fs-extra` vs `fs/promises`** — the codebase mixes both. Prefer `fs-extra` when you need directory-creation-on-write or existence checks; `fs/promises` otherwise.
- **JSON output is pretty-printed** with 2-space indent. Non-uniform indent creates massive diffs in bot PRs.
- **Silent per-record failures.** Several generators (tools schema-validation, dashboard partial-fetch) log errors and continue rather than failing the run. Watch the CI logs, not just exit codes.
- **YAML vs JSON tool files.** `.asyncapi-tool` files may be either — `helpers/utils::convertToJson` parses both transparently.

## Related chapters
- `workflows` — schedule + orchestration of these scripts
- `dashboard` — the dashboard-specific generator
- `docs-and-blog` — how the generated posts.json is rendered
- `testing` — the test conventions for scripts
