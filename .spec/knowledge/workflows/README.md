# Workflows — Chapter Overview
> Created: 2026-05-25 | Updated: 2026-05-25

## What this chapter covers

All GitHub Actions workflows under `.github/workflows/`: schedule and trigger definitions, step ordering, PR-open shape, secret usage, and safety model per workflow. This chapter covers the *orchestration* — for the scripts that these workflows invoke, see the `content-generation` and `dashboard` chapters.

Read this chapter for any task that:
- Modifies a `.github/workflows/*.yml` file
- Changes a workflow's schedule, triggers, permissions, or PR-open behaviour
- Investigates a failing weekly workflow run
- Adds or removes a workflow

## Key files

| Path | Role |
|------|------|
| `.github/workflows/` | 30+ workflow YAML files |
| `.github/workflows/scripts/` | Helper scripts referenced from multiple workflows |
| `.github/workflows/lighthouserc.json` | Lighthouse CI config used by `lighthouse-ci.yml` |

## Topics in this chapter

| Topic | Covers |
|-------|--------|
| [`regenerate-tools.md`](./regenerate-tools.md) | Weekly workflow that runs the tools pipeline and opens a PR. Manual approval gate. |
| [`regenerate-meetings-videos-dashboard.md`](./regenerate-meetings-videos-dashboard.md) | Daily workflow that regenerates meetings, videos, and dashboard JSON files in a single PR. |
| [`quality-and-testing.md`](./quality-and-testing.md) | CI workflows: `e2e.yml`, `lighthouse-ci.yml`, `netlify-edge-functions-test.yml`, `check-edit-links.yml`, `if-nodejs-pr-testing.yml`. |
| [`pr-automation.md`](./pr-automation.md) | PR-lifecycle workflows: `automerge*.yml`, `autoupdate.yml`, `lint-pr-title.yml`, `update-pr.yml`, `stale-issues-prs.yml`. |
| [`community-and-notifications.md`](./community-and-notifications.md) | Community engagement: `welcome-first-time-contrib.yml`, `add-good-first-issue-labels.yml`, `notify-*.yml`, `bounty-program-commands.yml`, `microgrant-program-commands.yml`. |

## Patterns

Every scheduled generator workflow follows the same shape:

1. Checkout repository
2. Resolve Node version from `package-lock.json` (via reusable action `asyncapi/.github/.github/actions/get-node-version-from-package-lock`)
3. Set up Node and install deps
4. Run one or more `npm run generate:X` scripts
5. Create a PR with the regenerated JSON via `peter-evans/create-pull-request`
6. On failure, notify the `94_bot-failing-ci` Slack channel via `8398a7/action-slack`

Every generator script under `scripts/` uses:
- `axios` or `node-fetch` for HTTP
- `fs-extra` / `fs/promises` for filesystem
- `helpers/logger.ts` for structured logging
- `helpers/utils::pause(ms)` for rate-limit-friendly delays

## Common gotchas

- **Fork gate** — most workflows guard with `if: github.repository == 'asyncapi/website'` so they don't run on forks.
- **Reusable action versions** — actions from `asyncapi/.github` are pinned via `@master`, which drifts. Version-specific workflows pin third-party actions by commit SHA.
- **`GH_TOKEN` vs `GITHUB_TOKEN`** — some workflows use the org-scoped `GH_TOKEN` secret (needed for cross-repo access), others use the default `GITHUB_TOKEN`.
- **PR labels** — some bot-opened PRs default to `do-not-merge`; some open with no label. See each workflow's topic page.
- **Slack failure notifications** use `SLACK_WEBHOOK_URL` = `SLACK_CI_FAIL_NOTIFY`.
- **Tolerated failures** — `regenerate-meetings-and-videos.yml` swallows dashboard-generation failures with a workflow warning (rather than failing the run). Other workflows fail hard.

## Related chapters
- `content-generation` — scripts invoked by these workflows
- `dashboard` — the dashboard generator specifically
- `deploy` — how workflow output ships to production
- `testing` — how CI test workflows tie to the test suites
