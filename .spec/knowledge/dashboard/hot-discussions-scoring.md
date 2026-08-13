# Hot discussions scoring
> Created: 2026-05-25 | Updated: 2026-05-25

## What this topic covers

How hot issues and hot PRs are ranked, enriched, filtered, and cut to the top 12 that appear on the dashboard. Everything in `getHotDiscussions` and `processHotDiscussions` in `scripts/dashboard/build-dashboard.ts`.

## Key files

| File | Role |
|------|------|
| `scripts/dashboard/build-dashboard.ts` | `getHotDiscussions`, `processHotDiscussions`, `monthsSince` |
| `scripts/dashboard/issue-queries.ts` | `hotDiscussionsIssues` and `hotDiscussionsPullRequests` GraphQL queries — define what fields are available for scoring |

## How it works

### 1. Batched processing
`getHotDiscussions` receives the combined array of hot issues and hot PRs. It processes in batches of 5:

```typescript
for (let i = 0; i < discussions.length; i += 5) {
  const batch = discussions.slice(i, i + 5);
  const batchResults = await processHotDiscussions(batch);
  await pause(1000);            // 1 second between batches
  result.push(...batchResults);
}
```

The batching serves two purposes: (a) constrain concurrent I/O when `processHotDiscussions` needs to re-fetch a discussion by ID; (b) pace the GraphQL API to avoid tripping secondary rate limits.

### 2. Per-discussion processing (`processHotDiscussions(batch)`)

For each discussion in the batch:

**Detect type**
```typescript
const isPR = discussion.__typename === 'PullRequest';
```

**Enrich comments if needed**
The initial hot-issues/PRs queries return `comments(first: 20)`. If a discussion has `comments.pageInfo.hasNextPage`, the initial 20-comment sample won't include some threads. In that case:

```typescript
if (item.comments.pageInfo?.hasNextPage) {
  const fetchedDiscussion = await getDiscussionByID(isPR, item.id);
  item = fetchedDiscussion.node;
}
```

`getDiscussionByID` uses `Queries.issueById` or `Queries.pullRequestById` — both fetch `comments(last: 100)` (or `first: 20` for PR, depending on the query as defined in `issue-queries.ts`), giving a fuller comment total.

**Interactions count**
```typescript
const interactionsCount =
  item.reactions.totalCount
  + item.comments.totalCount
  + item.comments.nodes.reduce((acc, curr) => acc + curr.reactions.totalCount, 0);
```

Base signal: `reactions + comments + reactions-on-comments`.

**PR-specific bonus**
```typescript
const finalInteractionsCount = isPR
  ? interactionsCount
    + item.reviews.totalCount
    + (item.reviews.nodes?.reduce((acc, curr) => acc + curr.comments.totalCount, 0) ?? 0)
  : interactionsCount;
```

For PRs, add the review count and the number of review-thread comments. Issues don't have reviews, so they don't get this bonus.

**Score formula**
```typescript
score: finalInteractionsCount / (monthsSince(item.timelineItems.updatedAt) + 2) ** 1.8
```

Interactions divided by `(monthsSinceUpdate + 2) ^ 1.8`. Older discussions decay steeply — the `+2` prevents division-by-zero and makes very recent discussions not dominate purely by recency. The `^ 1.8` power tuning skews the decay to be sharper than linear but softer than quadratic.

`monthsSince(date)` = `Math.floor((now - date) / 2592000)` where 2592000 = seconds in a 30-day month.

**Emit shape**
```typescript
{
  id, isPR,
  isAssigned: !!item.assignees.totalCount,
  title,
  author: item.author.login,
  resourcePath,
  repo: `asyncapi/${item.repository.name}`,
  labels: item.labels ? item.labels.nodes : [],
  score: finalInteractionsCount / (monthsSince(item.timelineItems.updatedAt) + 2) ** 1.8,
}
```

### 3. Final sort, filter, and cut
Back in `getHotDiscussions`:

```typescript
result.sort((a, b) => b.score - a.score);         // descending by score
const filteredResult = result.filter(issue => issue.author !== 'asyncapi-bot');
return filteredResult.slice(0, 12);
```

Sort by score descending. Filter out `asyncapi-bot`-authored items. Keep the top 12.

## Configuration

| Constant | Value | Purpose |
|---|---|---|
| `batchSize` (in `getHotDiscussions`) | `5` | Concurrency and pacing |
| `pause(1000)` | 1 second | Delay between batches |
| Score decay exponent | `1.8` | Skews the age-vs-interactions balance |
| Author filter | `'asyncapi-bot'` | Hardcoded bot exclusion |
| Top-N cut | `12` | Dashboard row count |

## Common gotchas

- **PR reviews weigh heavily.** A PR with many reviews will out-score a comparably-commented issue simply by having the review-count bonus. Deliberate — reviews are a strong engagement signal.
- **`monthsSince` uses a fixed 30-day month.** Long-tail discussions age slightly faster than calendar months.
- **`item.reactions.totalCount` from `last: 1` query.** The GraphQL query fetches only the last reaction (`reactions(last: 1)`) but reads `.totalCount`. Only the count matters — the nodes are ignored.
- **Comment reactions counted from the first 20 comments only** (unless the enrichment re-fetch happens). If a discussion has 100 comments where only comments 80-100 have reactions, those reactions won't affect the score.
- **Sort is by score, not by interactions.** Two discussions with the same interaction count but different ages get different scores.
- **`isAssigned` is a boolean from `assignees.totalCount`.** The initial query has `assignees(first: 1) { totalCount }` — cheap.
- **Bot filter is single-value.** Adding new bot accounts requires code change.
- **Top 12 is a hard cut.** Even if the 13th item has a score marginally lower than the 12th, it drops entirely.

## Related topics
- [`data-generation.md`](./data-generation.md) — where hot-discussions plug into the overall flow
- [`good-first-issues.md`](./good-first-issues.md) — the other data category
- [`rate-limiting-and-retries.md`](./rate-limiting-and-retries.md) — how the GraphQL calls behind the scenes are throttled
- [`README.md`](./README.md) — parent chapter
