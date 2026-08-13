# Rate-limiting and retries
> Created: 2026-05-25 | Updated: 2026-05-25

## What this topic covers

The three layers of protection that make the dashboard generator resilient to GitHub GraphQL API's various failure modes:

1. **`isRetryableError`** — classifies which errors are worth retrying
2. **`retryWithBackoff`** — wraps every GraphQL call with exponential backoff on retryable errors
3. **`adaptiveDelay`** — adjusts inter-request pause based on remaining rate-limit budget

All in `scripts/dashboard/build-dashboard.ts`.

## Key files

| File | Role |
|------|------|
| `scripts/dashboard/build-dashboard.ts` | Owns `isRetryableError`, `retryWithBackoff`, `adaptiveDelay` |
| `scripts/helpers/utils.ts` | `pause(ms)` primitive used throughout |

## How each layer works

### Layer 1 — `isRetryableError(error)`

Returns true if the error message (case-insensitive) contains any of:

- `secondary rate limit` — GitHub's abuse-detection back-off
- `502 bad gateway` — transient CDN/proxy failure
- `unicorn` — GitHub's Rails "something broke" error page
- `server error` — general 500-class
- `econnreset` — TCP connection dropped
- `etimedout` — request timed out

Any other error (auth, malformed query, missing schema field, etc.) is treated as fatal — not retried, propagated up immediately.

### Layer 2 — `retryWithBackoff(fn, context)`

Wraps an async function call in a retry loop:

```typescript
async function retryWithBackoff<T>(fn: () => Promise<T>, context: string): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {   // MAX_RETRIES = 3
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error)) throw error;               // fast-fail non-retryable
      if (attempt === MAX_RETRIES) break;
      const delayMs = RETRY_BASE_DELAY_MS * 2 ** attempt;      // RETRY_BASE_DELAY_MS = 60_000
      logger.warn(`Retryable error during ${context} (attempt ${attempt + 1}/${MAX_RETRIES}). Retrying in ${delayMs / 1000}s...`);
      await pause(delayMs);
    }
  }
  throw new Error(`Exhausted ${MAX_RETRIES} retries for ${context}: ${originalMessage}`);
}
```

Retry schedule: 60s → 120s → 240s → give up. Total worst-case retry wait: **7 minutes** before a fatal.

Every GraphQL call (`getDiscussions`, `getDiscussionByID`) is wrapped in `retryWithBackoff` with a `context` string like `getDiscussions page 3` or `getDiscussionByID <id>` — the context appears in log messages and the final error.

### Layer 3 — `adaptiveDelay(rateLimit)`

Called after every GraphQL response, before the next fetch. Reads `result.rateLimit.remaining` and `result.rateLimit.resetAt`:

| `remaining` band | Action |
|---|---|
| `≤ 100` | Wait until `resetAt` (+1 second), capped at 15 minutes |
| `101–500` | `pause(5000)` — 5 seconds |
| `> 500` | `pause(BASE_DELAY_MS)` — 2 seconds |

**Critical wait computation:**
```typescript
if (rateLimit.remaining <= 100) {
  const resetTime = new Date(rateLimit.resetAt).getTime();
  const safeResetTime = Number.isFinite(resetTime) ? resetTime : Date.now();
  const rawWaitMs = Math.max(safeResetTime - Date.now(), 0) + 1000;
  const waitMs = Math.min(rawWaitMs, MAX_ADAPTIVE_DELAY_MS);  // MAX_ADAPTIVE_DELAY_MS = 15 * 60_000
  logger.warn(`Rate limit critically low (${rateLimit.remaining} remaining). Waiting ${Math.round(waitMs / 1000)}s until reset.`);
  await pause(waitMs);
}
```

The 15-minute cap prevents pathological cases (e.g. clock skew reporting a reset hours in the future) from stalling the workflow indefinitely.

## Configuration

| Constant | Value | Purpose |
|---|---|---|
| `MAX_RETRIES` | `3` | Retry attempts per call |
| `RETRY_BASE_DELAY_MS` | `60_000` (60s) | Exponential-backoff base |
| `BASE_DELAY_MS` | `2000` (2s) | Healthy-state inter-request pause |
| `MAX_ADAPTIVE_DELAY_MS` | `15 * 60_000` (15 min) | Cap on rate-limit-reset wait |
| Rate-limit critical threshold | `100` | Trigger reset-wait |
| Rate-limit yellow threshold | `500` | Trigger 5s pause |

## Common gotchas

- **Non-retryable errors fast-fail.** A schema error (e.g. querying a field that doesn't exist) throws immediately — no retry, no delay. The `context` string in the error identifies which call.
- **Retry wait can exceed rate-limit reset wait.** The two aren't coordinated — you could retry-wait 4 minutes and then hit the rate-limit gate and wait another 15.
- **`adaptiveDelay` fires even on retries.** Successful retries still trigger the healthy-state delay. Cumulative pause per call in high-traffic mode can be substantial.
- **`resetAt` clock skew is defensive.** `Number.isFinite(resetTime)` guards against a nonsensical `resetAt` (e.g. GitHub returns a malformed timestamp).
- **Retry log messages include the attempt number** — grep `attempt 2/3` in CI logs to spot near-exhaustion.
- **`isRetryableError` uses `.toLowerCase()` includes** — a message like "Server Error: 502 Bad Gateway" matches on both `502 bad gateway` AND `server error` and only triggers one retry (it's still one retryable error).
- **`etimedout` doesn't cover fetch-level timeouts.** Node's `fetch` throws `AbortError`, not `ETIMEDOUT`. GraphQL client's underlying HTTP is what emits `ETIMEDOUT`.

## Related topics
- [`data-generation.md`](./data-generation.md) — where these three layers plug into the fetch flow
- [`hot-discussions-scoring.md`](./hot-discussions-scoring.md) — one of the two consumers of the wrapped fetch
- [`good-first-issues.md`](./good-first-issues.md) — the other consumer
- [`README.md`](./README.md) — parent chapter
