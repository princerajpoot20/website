# Dashboard — Chapter Overview
> Created: 2026-05-25 | Updated: 2026-05-25

## What this chapter covers

The AsyncAPI community dashboard: the daily generator that produces `dashboard.json` from the GitHub GraphQL API (fetching hot discussions and good-first-issues across every `asyncapi/*` repo), and the React components that render the resulting data. The dashboard is one of the most complex subsystems in the repo — the generator alone deals with cross-repo GraphQL, adaptive rate-limit handling, retries, batched enrichment, scoring, and partial-failure tolerance.

Read this chapter for any task touching:
- `scripts/dashboard/**` — the generator
- `dashboard.json` — the output
- `components/dashboard/**` — the frontend
- `pages/dashboard*` — the dashboard route
- The dashboard-generation step in `regenerate-meetings-and-videos.yml`

## Key files

### Generator
| File | Role |
|------|------|
| `scripts/dashboard/build-dashboard.ts` | Owns `start(writePath)`, all fetch/process/write logic |
| `scripts/dashboard/issue-queries.ts` | GraphQL query strings and query-builder functions (`Queries.hotDiscussionsIssues`, `Queries.hotDiscussionsPullRequests`, `Queries.goodFirstIssues`, `Queries.issueById`, `Queries.pullRequestById`) |

### Output
| File | Role |
|------|------|
| `dashboard.json` | Top-level file (NOT under `config/` — sits at repo root). Contains `hotDiscussions` (top 12 scored discussions) and `goodFirstIssues` (mapped list) |

### Frontend
| File | Role |
|------|------|
| `components/dashboard/GoodFirstIssues.tsx` | Section rendering the good-first-issues list |
| `components/dashboard/GoodFirstIssuesTip.tsx` | Explanatory tooltip about "good first issue" workflow |
| `components/dashboard/Header.tsx` | Dashboard page header |
| `components/dashboard/Button.tsx` | Dashboard-specific button |
| `components/dashboard/table/Table.tsx` | Main table component (hot discussions) |
| `components/dashboard/table/Row.tsx` | Table row |
| `components/dashboard/table/Filters.tsx` | Filter controls (author, repo, labels, etc.) |
| `components/dashboard/table/Pagination.tsx` | Pagination controls |

### Workflow
| File | Role |
|------|------|
| `.github/workflows/regenerate-meetings-and-videos.yml` | Runs `npm run generate:dashboard` daily, with `|| echo warning` guard so dashboard failures don't fail the workflow |

## Topics in this chapter

| Topic | Covers |
|-------|--------|
| [`data-generation.md`](./data-generation.md) | How `start(writePath)` orchestrates fetching hot discussions and good-first-issues; partial-failure handling; how the output file is written. |
| [`hot-discussions-scoring.md`](./hot-discussions-scoring.md) | The scoring formula that ranks discussions, how comments/reviews/reactions feed the score, filtering rules, top-12 cut. |
| [`good-first-issues.md`](./good-first-issues.md) | GraphQL query, label extraction, mapping to the frontend shape. |
| [`rate-limiting-and-retries.md`](./rate-limiting-and-retries.md) | Adaptive delay tied to `rateLimit.remaining`, `retryWithBackoff` with exponential backoff, `isRetryableError` classification. |
| [`frontend-components.md`](./frontend-components.md) | How `components/dashboard/**` consumes `dashboard.json` and renders. |

## Patterns

The generator is a good example of an **external-API generator with tolerated partial failure**:

```typescript
async function start(writePath: string): Promise<void> {
  let hotDiscussions = [], goodFirstIssues = [];
  let hotFailed = false, goodFirstFailed = false;

  // Two independent GraphQL fetches (issues + PRs) both wrapped in try/catch
  try { hotIssues = await getDiscussions(Queries.hotDiscussionsIssues(cutoffDate), ...); }
  catch (err) { hotIssuesFailed = true; ... }

  // ... same for PRs ...

  // Only fail if BOTH fetches failed
  if (hotIssuesFetchFailed && hotPRsFetchFailed) {
    hotDiscussionsFailed = true;
  } else {
    try { hotDiscussions = await getHotDiscussions(hotIssues.concat(hotPRs)); }
    catch { hotDiscussionsFailed = true; }
  }

  // Independent good-first-issues fetch
  try { rawGoodFirstIssues = await getDiscussions(Queries.goodFirstIssues, ...); ... }
  catch { goodFirstIssuesFailed = true; }

  // Throw only when EVERYTHING failed
  if (hotDiscussionsFailed && goodFirstIssuesFailed) {
    throw new Error('Dashboard generation failed: unable to fetch any data from GitHub.');
  }

  // Otherwise write partial data with a warning
  if (hotDiscussionsFailed || goodFirstIssuesFailed) {
    logger.warn('Dashboard generated with partial data due to errors above.');
  }

  await writeToFile({ hotDiscussions, goodFirstIssues }, writePath);
}
```

All external calls also go through `retryWithBackoff` (see [`rate-limiting-and-retries.md`](./rate-limiting-and-retries.md)).

## Common gotchas

- **Failure semantics are three-tier.** Both fetches fail → throw. One category fails → warn + write partial. All succeeded → write. The workflow additionally has `|| echo warning` so even a hard throw doesn't fail the workflow.
- **Output location.** `dashboard.json` lives at repo root, not `config/`. Unusual — every other generator writes under `config/`.
- **Cutoff date** for hot discussions is `now - 6 months`, computed via `getHotDiscussionsCutoffDate` which clamps day-of-month to handle month-boundary rollovers.
- **`asyncapi-bot`-authored discussions are filtered out** after scoring in `getHotDiscussions`.
- **Top 12 only.** After sort + filter, `slice(0, 12)` — the 13th hottest discussion never appears.
- **Enrichment via `getDiscussionByID`** — if a discussion has `comments.pageInfo.hasNextPage`, the full node is refetched by ID. This means the initial page-of-20 comment sample isn't the final count.
- **Rate-limit failures are silent when tolerated.** A retry-with-backoff exhaustion throws, but a `rateLimit.remaining <= 100` triggers a pause up to 15 minutes — the workflow may look "stuck" for that duration.

## Related chapters
- `content-generation` — sibling generators (meetings, videos, tools)
- `workflows/regenerate-meetings-videos-dashboard.md` — orchestration
- `frontend` — general Next.js layout the dashboard page inherits
