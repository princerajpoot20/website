# serve-definitions edge function
> Created: 2026-05-25 | Updated: 2026-05-25

## What this topic covers

The edge function at `netlify/edge-functions/serve-definitions.ts` — proxies AsyncAPI JSON schema and definition files from a canonical GitHub location (`asyncapi/spec-json-schemas` repo), sets the correct `Content-Type` header, and reports download success/error metrics to New Relic. Runs at the CDN edge under Deno.

## Key files

| File | Role |
|------|------|
| `netlify/edge-functions/serve-definitions.ts` | The edge function |
| `netlify/edge-functions/tests/` | Deno tests (invoked by `netlify-edge-functions-test.yml`) |

## How it works

### 1. URL pattern matching
The function's job is to decide whether a request is a "schema-related" download that should be proxied, or an unrelated URL that should pass through untouched.

**Regex used:**
```typescript
const SchemasRelatedRequestRegex =
  /^\/[\w\-]*\/?(?:([\w\-\.]*\/)?([\w\-$%\.]*\.json))?$/
```

Matches patterns like:
- `/definitions` — whole bundled schema
- `/schema-store/2.5.0-without-$id.json` — a specific schema file
- `/definitions/2.4.0/info.json` — a versioned definition file

Does NOT match:
- `/definitions/asyncapi.yaml` (not `.json`)
- `/schema-store/2.4.0.JSON` (uppercase extension)
- `/definitions/random/nested/path/file.json` (extra path segments)

Non-matching requests skip the whole function via `return await context.next()` — the request continues to Netlify's origin.

### 2. URL rewrite (`buildRewrite`)
When the regex matches:

```typescript
const definitionVersion = extractResult[1];  // e.g. "2.4.0/"
const file = extractResult[2];               // e.g. "info.json"

if (definitionVersion === undefined) {
  url = `${URL_DEST_SCHEMAS}/${file}`;
} else {
  url = `${URL_DEST_DEFINITIONS}/${definitionVersion}${file}`;
}
```

Where:
- `URL_DEST_SCHEMAS` = `https://raw.githubusercontent.com/asyncapi/spec-json-schemas/master/schemas`
- `URL_DEST_DEFINITIONS` = `https://raw.githubusercontent.com/asyncapi/spec-json-schemas/master/definitions`

The original request's headers are copied, and an `Authorization: token <GITHUB_TOKEN>` header is added — schema-related requests count against the GitHub API rate limit under the shared token.

Returns a new `Request(url, { method, headers })`.

### 3. Fetch and content-type override
```typescript
response = await fetch(rewriteRequest);

if (response.ok) {
  response = new Response(response.body, response);          // clone to modify headers
  response.headers.set("Content-Type", "application/schema+json");
}
```

Response headers are immutable — the response is cloned so `Content-Type` can be overridden. This ensures tooling that fetches these files gets the correct JSON Schema mime type (not `text/plain` from GitHub's raw content).

### 4. Metrics to New Relic
Only for `.json` file requests (not for the bare `/definitions` list). Two metric names based on outcome:

- `asyncapi.jsonschema.download.success` — for `response.ok` or `304 Not Modified` (cached)
- `asyncapi.jsonschema.download.error` — for any other status

**`newNRMetricCount`** builds a `NRMetric` object with:
- `type: Count`, `value: 1`, `interval.ms: 1`
- Attributes: `source` (path segment 1), `file` (last segment), `url`, `url_rewrite`, `version` (path segment 2, `.json` stripped), `file_type` (`schema` or `definition`), plus the passed extras (`responseStatus`, `responseStatusText`, `cached`)

**`sendMetricToNR`** posts to `NR_METRICS_ENDPOINT` (default `https://metric-api.eu.newrelic.com/metric/v1`) with:
- `Api-Key: <NR_API_KEY>`
- 2-second timeout via `AbortController`

Failure to post metrics is caught and logged via `context.log` — never fails the user's request.

## Configuration

| Env var | Purpose |
|---|---|
| `GITHUB_TOKEN_NR` | Auth for the GitHub raw-content fetch (higher rate limit than anonymous) |
| `NR_API_KEY` | New Relic API key for metrics submission |
| `NR_METRICS_ENDPOINT` | Override the New Relic endpoint (default EU) |

Constants at module scope:
- `URL_DEST_SCHEMAS`, `URL_DEST_DEFINITIONS` — pinned to `master` branch of `asyncapi/spec-json-schemas`

## Common gotchas

- **Case-sensitive `.json` matching.** `/definitions/foo.JSON` (uppercase) does NOT match — request passes through to origin, which likely 404s.
- **Path depth limited by regex.** Only supports 2 levels max under `/<source>/`. Deeper paths like `/definitions/nested/dir/file.json` pass through to origin.
- **Pinned to `master`.** The upstream URLs use `master` branch. Any structure change in `asyncapi/spec-json-schemas` breaks this function silently — metrics show `error` spikes.
- **Metrics timeout is 2 seconds.** The comment explicitly says "User's request is more important than collecting metrics." Missing metrics != failed request.
- **`user's request is more important` design.** Metric failures never affect the response. Debug: check `context.log` in Netlify function logs, not the user-facing HTTP response.
- **`interval.ms: 1`** on Count metrics. New Relic requires an interval; 1 ms is a shorthand meaning "this count applies to a 1 ms window" (effectively "point count").
- **Deno-specific imports.** `import type { Context } from "https://edge-bootstrap.netlify.app/v1/index.ts"` — URL import, works only in Deno. Tests must also import from URL.
- **`Deno.env.get` returns `undefined`** when the var isn't set. Callsites should defensively coalesce to empty string (as done for `NR_API_KEY`).

## Related topics
- [`README.md`](./README.md) — parent chapter
- `../workflows/quality-and-testing.md` — the Deno test workflow that covers this function
- `../deploy.md` — where the edge function is deployed
