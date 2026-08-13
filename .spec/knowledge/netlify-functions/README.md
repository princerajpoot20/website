# Netlify Functions — Chapter Overview
> Created: 2026-05-25 | Updated: 2026-05-25

## What this chapter covers

Serverless code that runs on Netlify: regular functions in `netlify/functions/`, edge functions in `netlify/edge-functions/`, and background functions (a Netlify subtype of regular functions). Each function is a distinct integration — newsletter signup via Kit, GitHub Discussions feedback proxy, Slack-to-Discussions bridge, AsyncAPI schema definitions server.

Read this chapter for any task touching serverless endpoints, form submissions, edge-side routing, or Slack/GitHub integrations that live in `netlify/`.

## Key files

| File | Role |
|------|------|
| `netlify/functions/newsletter_subscription.ts` | Newsletter signup handler using Kit (formerly ConvertKit) API |
| `netlify/functions/github_discussions.ts` | Proxy for creating GitHub Discussions from the site's feedback card |
| `netlify/functions/save-discussion-background/` | Background function that saves a Slack thread as a GitHub Discussion |
| `netlify/edge-functions/serve-definitions.ts` | Edge function that proxies AsyncAPI spec JSON schemas from GitHub with metrics to New Relic |
| `netlify/edge-functions/tests/` | Deno tests for edge functions |
| `netlify.toml` | Function config, headers, redirects |

## Topics in this chapter

| Topic | Covers |
|-------|--------|
| [`serve-definitions.md`](./serve-definitions.md) | Edge function that rewrites requests for `/definitions/*` and `/schema-store/*` to `raw.githubusercontent.com`, sets `Content-Type: application/schema+json`, and reports download metrics to New Relic. |
| [`github-discussions.md`](./github-discussions.md) | POST-only function that opens a GitHub Discussion via GraphQL. Powers the site's Feedback card. |
| [`newsletter-subscription.md`](./newsletter-subscription.md) | POST-only function that subscribes users to a Kit tag based on the requested interest (Newsletter / Meetings / TSC Voting). |
| [`save-discussion-background.md`](./save-discussion-background.md) | Background function invoked by Slack when a maintainer selects "Save Discussion". Reads a thread, opens a Slack dialog, creates a GitHub Discussion with replies. |

## Patterns

- **Regular functions** — export `handler` typed as `@netlify/functions::Handler`, receive `HandlerEvent`, return `{ statusCode, body }`.
- **Edge functions** — export a default async function `(request, context) => Promise<Response>`. Runs on Deno at the CDN edge. Different runtime from regular functions (Deno stdlib, `Deno.env.get` for env vars, imports from URLs).
- **Background functions** — same shape as regular functions but with `-background` folder suffix. Netlify does not wait for the response; timeout is 15 min instead of the normal 10 seconds.

Every function has:
- HTTP-method allow-list (usually POST-only)
- Explicit request-body parse with typed guard
- Secrets read via `process.env.*` (regular) or `Deno.env.get(*)` (edge)
- Structured error responses (JSON body with `message`)

## Common gotchas

- **Edge functions run under Deno.** Cannot import from `npm` packages directly — must use URL imports (e.g. `https://edge-bootstrap.netlify.app/v1/index.ts`). `fetch` and `AbortController` are globals; Node-specific APIs are unavailable.
- **Env vars** must be set in the Netlify UI (or via `netlify.toml`). Missing env vars = runtime 500 in prod. Locally, use `netlify dev` to inject them.
- **Background functions** don't return a body to the caller (Netlify returns 202 immediately). Any output must go somewhere out-of-band (Slack, GitHub API, logs).
- **CORS** — several endpoints are called cross-origin (e.g. from Studio at `studio.asyncapi.com`). Response headers must include `Access-Control-Allow-Origin: *` (or specific origin) — check `netlify.toml` for global overrides.
- **Function timeout** — regular functions are 10s (Netlify default). Anything slower must move to a background function.
- **Different token env vars per function.** `github_discussions.ts` uses `GITHUB_TOKEN_CREATE_DISCUSSION`; `serve-definitions.ts` uses `GITHUB_TOKEN_NR`. These are scoped separately for permission reasons.

## Related chapters
- `deploy` — Netlify build and function deployment
- `frontend` — the components that call these endpoints
- `workflows/quality-and-testing.md` — CI wiring for edge-function tests
