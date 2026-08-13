# Good-first-issues
> Created: 2026-05-25 | Updated: 2026-05-25

## What this topic covers

The good-first-issues data path: the GraphQL query that discovers issues labelled `"good first issue"` across every `asyncapi/*` repo, and `mapGoodFirstIssues` that reshapes the raw GraphQL nodes into the simplified frontend format. Everything relevant is in `scripts/dashboard/build-dashboard.ts` and the `goodFirstIssues` query in `issue-queries.ts`.

## Key files

| File | Role |
|------|------|
| `scripts/dashboard/build-dashboard.ts` | `mapGoodFirstIssues`, `getLabel` |
| `scripts/dashboard/issue-queries.ts` | `Queries.goodFirstIssues` — the GraphQL search query |

## How it works

### 1. Query
```graphql
query($first: Int!, $after: String) {
  search(
    first: $first
    after: $after
    type: ISSUE
    query: "org:asyncapi state:open is:issue label:\"good first issue\""
  ) {
    pageInfo { hasNextPage endCursor }
    nodes {
      __typename
      ... on Issue {
        assignees(first:1) { totalCount }
        author { login }
        id
        title
        resourcePath
        repository { name }
        labels(first: 10) {
          nodes {
            name
            color
          }
        }
      }
    }
  }
  rateLimit { limit cost remaining resetAt }
}
```

Key filters (all in the `query` string, not as GraphQL args):
- `org:asyncapi` — every repo in the AsyncAPI org
- `state:open` — closed issues never appear
- `is:issue` — no PRs
- `label:"good first issue"` — the canonical newcomer-friendly label

Per-issue fields fetched: assignee count, author login, id, title, path, repo name, first 10 labels.

### 2. Pagination
`getDiscussions(Queries.goodFirstIssues, PAGE_SIZE, null, MAX_PAGES_GOOD_FIRST_ISSUES)` — paginates with `PAGE_SIZE = 30` up to `MAX_PAGES_GOOD_FIRST_ISSUES = 5` pages (150 max).

Rate-limit protection is the same as hot-discussions — every page fetch runs under `retryWithBackoff` + `adaptiveDelay`. See [`rate-limiting-and-retries.md`](./rate-limiting-and-retries.md).

### 3. Mapping via `mapGoodFirstIssues`
```typescript
issues.map(issue => ({
  id: issue.id,
  title: issue.title,
  isAssigned: !!issue.assignees.totalCount,
  resourcePath: issue.resourcePath,
  repo: `asyncapi/${issue.repository.name}`,
  author: issue.author.login,
  area: getLabel(issue, 'area/') || 'Unknown',
  labels: issue.labels!.nodes.filter(
    label => !label.name.startsWith('area/') && !label.name.startsWith('good first issue')
  ),
}));
```

**`area` extraction (`getLabel(issue, 'area/')`)**
Every AsyncAPI issue tends to have an area label like `area/docs`, `area/parser`, `area/spec` etc. `getLabel` walks the labels, finds the first whose name starts with `area/`, splits by `/`, and returns the segment after the first `/`. So `area/docs` → `docs`. Missing area label → `'Unknown'`.

**Labels filter**
The `labels` array shipped to the frontend excludes:
- Anything starting with `area/` (already surfaced via the `area` field)
- The `good first issue` label itself (redundant — every entry has it)

So a typical shipped labels array is short — things like `bug`, `docs`, `help wanted`, etc.

## Configuration

| Var | Purpose |
|---|---|
| `GITHUB_TOKEN` env | GraphQL auth |
| `PAGE_SIZE` | `30` |
| `MAX_PAGES_GOOD_FIRST_ISSUES` | `5` |
| GraphQL query filters | Hardcoded in `issue-queries.ts` |

## Common gotchas

- **`area/` label convention is org-wide but not enforced.** An issue without any `area/*` label gets bucketed as `'Unknown'`. Reviewers should apply an area label when triaging.
- **Only the first `area/*` label wins.** If an issue has both `area/docs` and `area/parser`, only the first-encountered survives — and label order in the GraphQL response is not stable.
- **`labels(first: 10)`.** Issues with more than 10 labels have some silently dropped. The dropped ones don't show on the dashboard.
- **`assignees(first: 1) { totalCount }`.** Cheap check; `isAssigned` is a boolean, not a list.
- **`state:open` is on the search string, not a GraphQL variable.** Changing to include closed issues requires editing the query string.
- **`good first issue` label name is case-sensitive** and requires the exact string. Some repos may use `Good First Issue` (capitalized) or `good-first-issue` (hyphenated) — those don't match.
- **No score / sort.** Unlike hot discussions, good-first-issues are shipped in the order the GraphQL search returned them — usually most recently updated.
- **Bot filter not applied here.** `asyncapi-bot`-opened good-first-issues (rare, but possible) do appear.
- **Repository name is short-form.** `issue.repository.name` gives just `spec` or `parser-js`, not `asyncapi/spec` — the mapping code re-prefixes with `asyncapi/`.

## Related topics
- [`data-generation.md`](./data-generation.md) — how this fetch fits into the overall flow
- [`hot-discussions-scoring.md`](./hot-discussions-scoring.md) — sibling data category
- [`README.md`](./README.md) — parent chapter
- [`frontend-components.md`](./frontend-components.md) — how the mapped data is displayed
