# Dashboard data generation
> Created: 2026-05-25 | Updated: 2026-05-25

## What this topic covers

The `start(writePath)` function in `scripts/dashboard/build-dashboard.ts` — how it orchestrates three GitHub GraphQL fetches (hot issues, hot PRs, good-first-issues), combines and post-processes them, and writes `dashboard.json`. The core control flow with all its partial-failure branches.

## Key files

| File | Role |
|------|------|
| `scripts/dashboard/build-dashboard.ts` | Owns `start`, `getDiscussions`, `writeToFile` |
| `scripts/dashboard/issue-queries.ts` | GraphQL query strings |

## How it works

### 1. Compute the cutoff date
`getHotDiscussionsCutoffDate()` returns an ISO date string 6 months in the past. It clamps day-of-month so that if today is e.g. Aug 31, the cutoff is not Feb 31 (which would wrap to Mar 3). Concretely:

```typescript
const now = new Date();
const targetMonth = now.getMonth() - 6;                                   // HOT_DISCUSSIONS_MONTHS_BACK
const lastDayOfTargetMonth = new Date(now.getFullYear(), targetMonth + 1, 0).getDate();
const clampedDay = Math.min(now.getDate(), lastDayOfTargetMonth);
return new Date(now.getFullYear(), targetMonth, clampedDay)
  .toISOString().split('T')[0];   // YYYY-MM-DD
```

This cutoff is embedded into the hot-issue and hot-PR search queries as `updated:>{cutoff}`.

### 2. Fetch hot issues (isolated try/catch)
```typescript
hotIssues = await getDiscussions(
  Queries.hotDiscussionsIssues(cutoffDate),
  PAGE_SIZE,       // 30
  null,            // start cursor
  MAX_PAGES_HOT_DISCUSSIONS   // 5
);
```
Failure flips `hotIssuesFetchFailed = true` but doesn't rethrow.

`getDiscussions` uses `@octokit/graphql` under `retryWithBackoff` (see [`rate-limiting-and-retries.md`](./rate-limiting-and-retries.md)). It recursively paginates by passing `endCursor` until `!hasNextPage` or `currentPage >= maxPages`. Between page fetches it calls `adaptiveDelay(result.rateLimit)`.

### 3. Fetch hot PRs (also isolated)
Same shape, different query (`Queries.hotDiscussionsPullRequests(cutoffDate)`). Independent try/catch — one can fail without blocking the other.

### 4. Combine or bail
```typescript
if (hotIssuesFetchFailed && hotPRsFetchFailed) {
  hotDiscussionsFailed = true;
} else {
  try {
    hotDiscussions = await getHotDiscussions(hotIssues.concat(hotPRs));
  } catch (error) {
    hotDiscussionsFailed = true;
  }
}
```
If both raw fetches failed, skip processing. If at least one succeeded, run `getHotDiscussions` which does scoring + top-12 selection (see [`hot-discussions-scoring.md`](./hot-discussions-scoring.md)).

### 5. Fetch good-first-issues (fully independent)
```typescript
const rawGoodFirstIssues = await getDiscussions(
  Queries.goodFirstIssues,
  PAGE_SIZE,        // 30
  null,
  MAX_PAGES_GOOD_FIRST_ISSUES   // 5
);
goodFirstIssues = await mapGoodFirstIssues(rawGoodFirstIssues);
```
See [`good-first-issues.md`](./good-first-issues.md) for the mapping details.

### 6. Terminal failure check
```typescript
if (hotDiscussionsFailed && goodFirstIssuesFailed) {
  throw new Error('Dashboard generation failed: unable to fetch any data from GitHub.');
}
if (hotDiscussionsFailed || goodFirstIssuesFailed) {
  logger.warn('Dashboard generated with partial data due to errors above.');
}
```
Only when **both** primary categories fail does the script throw. A single-category failure produces a warning and a partial-data dashboard.

### 7. Write
```typescript
await writeToFile({ hotDiscussions, goodFirstIssues }, writePath);
```
`writeToFile` `JSON.stringify(content, null, '  ')` (2-space indent) and writes atomically via `writeFile`. Errors are logged with the target path and rethrown.

### 8. CLI invocation
```typescript
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  start(resolve(currentDirPath, '..', '..', 'dashboard.json'));
}
```
Only runs `start` when executed as a script (not when imported for tests). The write path is fixed as `dashboard.json` at repo root — NOT under `config/`.

## Configuration

| Constant | Value | Purpose |
|---|---|---|
| `HOT_DISCUSSIONS_MONTHS_BACK` | `6` | Cutoff window |
| `PAGE_SIZE` | `30` | Per-page GraphQL result count |
| `MAX_PAGES_HOT_DISCUSSIONS` | `5` | Caps at 150 hot issues + 150 hot PRs |
| `MAX_PAGES_GOOD_FIRST_ISSUES` | `5` | Caps at 150 good-first-issues |
| `BASE_DELAY_MS` | `2000` | Baseline pause between healthy fetches |
| `MAX_RETRIES` | `3` | Retry attempts on retryable errors |
| `RETRY_BASE_DELAY_MS` | `60000` | Base for exponential backoff |
| `MAX_ADAPTIVE_DELAY_MS` | `15 * 60_000` | Cap on adaptive rate-limit wait (15 min) |
| `GITHUB_TOKEN` env | | GraphQL auth |

## Common gotchas

- **`dashboard.json` at repo root** — no other generator writes here. Anything cleaning `config/` will miss it.
- **Silent partial output.** A single-category failure produces a JSON file with `hotDiscussions: []` OR `goodFirstIssues: []` — the frontend must gracefully handle either being empty.
- **Total wall time can exceed 15 minutes.** Adaptive-delay pauses can hit the 15-min cap. The workflow's job timeout must accommodate.
- **Ordered `try` blocks.** The five try/catches are sequential, not parallel. Total runtime is the sum of hot-issues + hot-PRs + hot-processing + good-first-issues (plus every adaptive delay).
- **Concat before scoring.** `hotIssues.concat(hotPRs)` mixes them into a single array before scoring — the scorer must handle both types (see `hot-discussions-scoring.md`).
- **PAGE_SIZE * MAX_PAGES caps are advisory.** The actual result count depends on how many items match the search — usually fewer than the cap.
- **CLI-invocation guard** is important for tests. Importing `start` in a test file does NOT trigger a real run.

## Related topics
- [`hot-discussions-scoring.md`](./hot-discussions-scoring.md) — what happens after fetching
- [`good-first-issues.md`](./good-first-issues.md) — the third fetch
- [`rate-limiting-and-retries.md`](./rate-limiting-and-retries.md) — how each fetch is protected
- [`README.md`](./README.md) — parent chapter
