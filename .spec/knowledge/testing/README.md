# Testing — Chapter Overview
> Created: 2026-05-25 | Updated: 2026-05-25

## What this chapter covers

Test layout, runners, and conventions across the codebase. Jest for unit and script tests, Cypress for E2E, and Deno for edge function tests.

Read this chapter before adding tests or debugging a failing test suite.

## Key files

| File | Role |
|------|------|
| `jest.config.js` | Jest configuration |
| `tests/` | Unit + script tests, mirrors `scripts/` structure |
| `tests/fixtures/` | Shared test data |
| `cypress/` | E2E specs |
| `cypress.config.js` | Cypress configuration |
| `netlify/edge-functions/tests/` | Deno tests for edge functions |
| `.github/workflows/e2e.yml` | Cypress on PR |
| `.github/workflows/netlify-edge-functions-test.yml` | Deno tests on PR |

## Pattern

- **Unit tests** live in `tests/`, mirroring the source layout under `scripts/` or `components/`.
- **File naming:** `{source-name}.test.ts` (or `.test.tsx` for components).
- **Fixtures** in `tests/fixtures/` — reused across suites.
- **Coverage** produced in `coverage/`, uploaded to Codecov via workflow.

## Common gotchas

- **`jest.config.js`** uses a custom `testPathIgnorePatterns` — new test folders may need explicit inclusion.
- **Long-running Cypress** — E2E workflow is slow (~10 min); do not add to unit test path.
- **Snapshot tests** are used for MDX components; update carefully (`--updateSnapshot`).
- **Edge function tests** run under Deno, not Jest — different assertion syntax.

## Related chapters
- `content-pipeline` — how generator tests are structured
- `deploy` — where tests run in CI
