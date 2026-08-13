# Fetching tool files from GitHub
> Created: 2026-05-25 | Updated: 2026-05-25

## What this topic covers

How the pipeline discovers `.asyncapi-tool` files across every public repository on GitHub, aggregates the results across paginated responses, and later downloads the raw content of each file. Everything in `scripts/tools/extract-tools-github.ts` plus the per-tool download performed at the start of `tools-object.ts::convertTools`.

## Key files

| File | Role |
|------|------|
| `scripts/tools/extract-tools-github.ts` | Owns the GitHub code-search calls and pagination. Exports `getData()`. |
| `scripts/tools/tools-object.ts` | Consumes the aggregated items; for each item, downloads the raw tool file via `raw.githubusercontent.com` and parses as JSON/YAML. |
| `scripts/helpers/utils.ts` | Provides `pause(ms)` used between paginated requests. |

## How it works

### 1. Auth
`getData()` requires `process.env.GITHUB_TOKEN`. If missing, it throws immediately. The token is sent as `authorization: token <GH_TOKEN>` on every request. Locally the token comes from `.env` (loaded by `dotenv`). In workflow runs it comes from the `GH_TOKEN` GitHub secret.

### 2. Search request
The pipeline uses the GitHub code search API:

```
GET https://api.github.com/search/code
    ?q=filename:.asyncapi-tool
    &per_page=50
    &page=<n>
```

Headers include `accept: application/vnd.github.text-match+json`. `per_page` is hardcoded to 50.

### 3. Pagination
The first request returns `data.items[]` (up to 50 tool file references) and a boolean `data.incomplete_results`. When `incomplete_results` is `true`, more pages remain. The pipeline loops:

- Increments the page counter
- Logs `"Fetching page: <n>"`
- Sleeps for 1000 ms via `pause(1000)` to respect the code-search rate limit (30 req/min)
- Fetches the next page
- Adds new items to an aggregation `Set`
- Reads `incomplete_results` again to decide whether to continue

Aggregation uses a `Set`, so if GitHub returns overlapping items across pages the aggregation dedupes by reference identity.

### 4. Aggregated result shape
Every item in the aggregated list has (relevant fields):
- `name` — the file name (expected to start with `.asyncapi-tool`)
- `path` — path within the repo
- `url` — API URL with a `ref` query param at the end (the SHA used for stable download)
- `repository.full_name` — `owner/repo`
- `repository.html_url` — public repo URL
- `repository.description` — repo description (used as fallback tool description)
- `repository.owner.login` — repo owner login (used to derive `isAsyncAPIrepo`)

`getData` returns this aggregated list (assigned back onto `result.data.items` and then `.items` returned).

### 5. Per-tool download
`tools-object.ts::convertTools` iterates the aggregated items via `Promise.all`. For each item whose `name` starts with `.asyncapi-tool`:

1. Extracts the ref from `tool.url.split('=')[1]` — this is the SHA at which the file was indexed.
2. Constructs the raw URL: `https://raw.githubusercontent.com/{repository.full_name}/{ref}/{tool.path}`
3. `axios.get(rawUrl)` returns the file body as a string.
4. `helpers/utils::convertToJson` parses YAML or JSON transparently.

The parsed object then flows to validation and categorisation (see [`validation-and-categorisation.md`](./validation-and-categorisation.md)).

## Configuration

| Variable | Purpose |
|---|---|
| `GITHUB_TOKEN` | Auth for the search API. Loaded via `dotenv` locally, secret in workflows. |

No other env or config file influences fetching.

## Common gotchas

- **`per_page=50`** — the request page size is smaller than the API's max (100). This is intentional; larger pages sometimes truncate results.
- **1-second pause between pages** — required by the code-search rate limit. Removing it produces 403s on large result sets.
- **`incomplete_results` semantics** — the flag means "the search index is still catching up", not necessarily "more pages exist". In practice the code treats it as "keep paginating until we get a false".
- **Ref-pinned raw URLs** — using the ref from the search response ensures the download matches the file the search indexed, even if the repo has since force-pushed.
- **Non `.asyncapi-tool` files silently skipped** — the `startsWith` guard in `convertTools` drops any search hit whose name doesn't begin with `.asyncapi-tool` (defensive against search hits on similarly-named files).

## Related topics
- [`validation-and-categorisation.md`](./validation-and-categorisation.md) — what happens to each downloaded tool file
- [`workflow-and-pr.md`](./workflow-and-pr.md) — where `GH_TOKEN` is set in the workflow
