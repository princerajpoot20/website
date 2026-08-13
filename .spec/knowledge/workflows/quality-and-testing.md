# Quality and testing workflows
> Created: 2026-05-25 | Updated: 2026-05-25

## What this topic covers

CI workflows that run on PRs and gate quality: E2E (Cypress), Lighthouse audits, edge function tests (Deno), markdown link check, and Node.js PR test workflows sourced from the shared `asyncapi/.github` config.

## Key files

| Workflow | Purpose |
|---|---|
| `.github/workflows/e2e.yml` | Runs Cypress E2E against the built site on PR |
| `.github/workflows/lighthouse-ci.yml` | Lighthouse audit against the preview deploy; configured by `.github/workflows/lighthouserc.json` |
| `.github/workflows/netlify-edge-functions-test.yml` | Runs Deno tests for `netlify/edge-functions/**` |
| `.github/workflows/check-edit-links.yml` | Uses `mlc_config.json` to check external and internal markdown links across the docs |
| `.github/workflows/if-nodejs-pr-testing.yml` | Standard AsyncAPI Node.js PR tests (from shared `.github` config) |
| `.github/workflows/if-nodejs-pr-results.yml` | Publishes results from the Node.js PR test workflow |
| `.github/workflows/validate-case-studies-structures.yaml` | Enforces the shape of files under `pages/casestudies/**` |

## How it works

- **`e2e.yml`** builds the site and runs Cypress specs from `cypress/`. Long-running (~10 min). Runs on `pull_request`.
- **`lighthouse-ci.yml`** waits for the Netlify preview deploy URL for the PR, then runs Lighthouse against it and comments the results.
- **`netlify-edge-functions-test.yml`** uses Deno (edge functions run under Deno at runtime) to execute tests in `netlify/edge-functions/tests/`.
- **`check-edit-links.yml`** runs `markdown-link-check` across docs; `mlc_config.json` at repo root defines ignore patterns and retry behaviour.
- **`if-nodejs-pr-testing.yml` / `if-nodejs-pr-results.yml`** are shared workflow files kept in sync from `asyncapi/.github`. They run standard Node.js tests (lint, unit, build) via a pull request testing pattern.
- **`validate-case-studies-structures.yaml`** ensures case study JSON/MDX has the required frontmatter and shape.

## Configuration

| File | Role |
|---|---|
| `mlc_config.json` | markdown-link-check configuration used by `check-edit-links.yml` |
| `lighthouserc.json` (under `.github/workflows/`) | Lighthouse CI configuration referenced by `lighthouse-ci.yml` |
| `cypress.config.js` | Cypress project configuration |
| `jest.config.js` | Jest configuration (used by the Node.js PR test workflow) |

## Common gotchas

- **`lighthouse-ci.yml`** waits for the preview deploy; if Netlify is slow or fails, the workflow times out.
- **E2E flakes** appear when the preview or local build has intermittent hydration issues — retries are configured but limited.
- **`mlc_config.json` patterns** are checked as-is; a wrongly-quoted pattern silently matches everything or nothing.
- **Shared `if-nodejs-*` workflows** are updated by the `.github/workflows/scripts/` sync (see `pr-automation.md`); locally-edited versions are overwritten on the next sync run.
- **Deno edge tests** don't use Jest, don't share test utils with unit tests, and have their own assertion syntax.

## Related topics
- [`README.md`](./README.md) — shared workflow patterns
- `../testing/README.md` — how unit and E2E tests are structured
