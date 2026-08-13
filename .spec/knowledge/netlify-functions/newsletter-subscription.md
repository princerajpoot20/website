# newsletter-subscription function
> Created: 2026-05-25 | Updated: 2026-05-25

## What this topic covers

The regular Netlify function at `netlify/functions/newsletter_subscription.ts` — subscribes an email address to a Kit (formerly ConvertKit) subscriber tag based on the requested interest. Powers the newsletter signup card on `pages/newsletter.tsx`.

## Key files

| File | Role |
|------|------|
| `netlify/functions/newsletter_subscription.ts` | The handler |

## How it works

### 1. Method gate
Only `POST`. Anything else returns 405 with `{ message: 'The specified HTTP method is not allowed.' }`.

### 2. Interest mapping
Three predefined interests, each maps to a distinct Kit tag ID env var:

```typescript
const INTEREST_TO_ENV = {
  Newsletter: 'KIT_NEWSLETTER_TAG_ID',
  Meetings: 'KIT_MEETINGS_TAG_ID',
  'TSC Voting': 'KIT_TSC_TAG_ID',
} as const;
```

Type-guard `isValidInterest(s)` ensures the incoming string is one of these three keys.

### 3. Parse and validate request
```typescript
try {
  body = JSON.parse(event.body ?? '{}');
} catch { return 400 with 'Invalid request body.'; }
```

Additional validation (in the extended body of the function): the body is expected to contain at least an email and an interest string. `parseTagId(raw)` converts the resolved env-var value to a positive integer; anything else → `null` (treated as misconfiguration).

### 4. Kit API call
```typescript
const KIT_BASE = 'https://api.kit.com/v4';
const REQUEST_TIMEOUT_MS = 15_000;

async function kitFetch(url, init) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}
```

15-second timeout per Kit call via `AbortController`. `isAbortError` detects abort so timeouts can be distinguished from other errors in the response.

The actual call subscribes/adds the tag to the given email through the Kit v4 API. On success returns 200; on Kit failure the status code is propagated.

## Configuration

| Env var | Purpose |
|---|---|
| `KIT_NEWSLETTER_TAG_ID` | Kit tag ID for the general Newsletter interest |
| `KIT_MEETINGS_TAG_ID` | Kit tag ID for the Meetings interest |
| `KIT_TSC_TAG_ID` | Kit tag ID for TSC Voting notifications |
| `KIT_API_KEY` (or equivalent auth env — see the function file) | Auth for the Kit API |

Constants:
- `KIT_BASE` — Kit v4 API base
- `REQUEST_TIMEOUT_MS` — 15 seconds

## Common gotchas

- **Interest values are exact strings including whitespace.** `'TSC Voting'` (with space) must be sent verbatim by the client — case-sensitive, whitespace-sensitive.
- **`parseTagId`** requires a positive integer. Zero, negative, non-numeric, or empty env vars are treated as missing config.
- **Timeout returns different error than a genuine Kit failure.** Callers should distinguish 5xx from timeout-induced errors when troubleshooting.
- **Kit was formerly ConvertKit.** Some historic docs / commits mention ConvertKit; the API is the same but the URL rebranded.
- **No email validation.** The function accepts any string as the email and lets Kit reject it.
- **No idempotency guarantee.** Repeated submissions add the same tag repeatedly (Kit handles this gracefully — the API is upsert-ish).
- **No CORS headers in the response** — must be set globally in `netlify.toml` if the client is cross-origin.

## Related topics
- [`README.md`](./README.md) — parent chapter
- `../frontend/README.md` — `components/NewsletterSubscribe.tsx` is the client
