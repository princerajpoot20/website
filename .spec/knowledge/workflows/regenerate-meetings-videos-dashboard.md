# regenerate-meetings-and-videos workflow
> Created: 2026-05-25 | Updated: 2026-05-25

## What this topic covers

The daily workflow that regenerates three artifacts: `config/meetings.json` (from Google Calendar), `config/newsroom_videos.json` (from YouTube), and `dashboard.json` (from the GitHub GraphQL API). It packages the changes into a single PR for maintainer review. For details of what each generator script does, see the `content-generation` and `dashboard` chapters.

## Key files

| File | Role |
|------|------|
| `.github/workflows/regenerate-meetings-and-videos.yml` | Workflow definition (daily cron + workflow_dispatch) |
| `scripts/build-meetings.ts` | Meetings generator (`npm run generate:meetings`) |
| `scripts/build-newsroom-videos.ts` | Videos generator (`npm run generate:videos`) |
| `scripts/dashboard/build-dashboard.ts` | Dashboard generator (`npm run generate:dashboard`) |

## How it works

### 1. Triggers
- **Schedule** — `cron: "10 0 * * *"` — 00:10 UTC every day
- **Manual** — `workflow_dispatch`

### 2. Guard
`if: github.repository == 'asyncapi/website'` — canonical repo only.

### 3. Steps
1. Checkout
2. Resolve Node version via reusable action
3. Set up Node with npm cache
4. `npm install`
5. **Regenerate meetings and videos** — runs `npm run generate:meetings` and `npm run generate:videos` sequentially in a single shell step
6. **Regenerate dashboard** — runs `npm run generate:dashboard`, guarded with `|| echo "::warning::Dashboard generation failed, continuing with available data"`. Dashboard failures do NOT fail the workflow; the other files still ship.
7. **Open PR** via `peter-evans/create-pull-request`
8. On failure, notify `94_bot-failing-ci` Slack channel

### 4. PR shape

| Field | Value |
|---|---|
| `commit-message` | `chore: update meetings.json, newsrooom_videos.json and dashboard.json` |
| `title` | `chore: update meetings.json and newsrooom_videos.json` (note: title doesn't mention dashboard, though commit-message does — historical, from when dashboard was added) |
| `committer` / `author` | `asyncapi-bot <info@asyncapi.io>` |
| `branch` | `update-meetings/${{ github.sha }}` — SHA-scoped, so each run gets a unique branch |

Note: unlike `regenerate-tools`, this workflow does NOT set a `labels` param on the PR — so the PR opens with no label by default. The `do-not-merge` label may still be applied via the label workflows elsewhere.

### 5. Environment / secrets
Job-level env:
- `CALENDAR_ID` = `${{ secrets.CALENDAR_ID }}` — Google Calendar ID for meetings
- `CALENDAR_SERVICE_ACCOUNT` = `${{ secrets.CALENDAR_SERVICE_ACCOUNT }}` — Google service-account JSON credentials
- `YOUTUBE_TOKEN` = `${{ secrets.YOUTUBE_TOKEN }}` — YouTube Data API key
- `GITHUB_TOKEN` = `${{ secrets.GH_TOKEN }}` — used by dashboard script for GraphQL calls and by `peter-evans/create-pull-request` to open the PR

For the failure Slack step: `SLACK_WEBHOOK_URL` = `${{ secrets.SLACK_CI_FAIL_NOTIFY }}`.

## Configuration

| Setting | Where |
|---|---|
| Schedule | `on.schedule.cron` in the workflow file |
| SHA-scoped branch naming | `update-meetings/${{ github.sha }}` — one branch per run, PRs don't overwrite |

## Common gotchas

- **Dashboard failures are tolerated.** The `|| echo "::warning::..."` in step 6 means the workflow succeeds even when dashboard generation fails. Watch the workflow annotations, not just the exit code.
- **SHA-scoped branch names accumulate.** Every run creates a new branch. Old branches don't auto-delete when the PR closes; periodic cleanup is manual.
- **PR title lags commit message.** The title says "meetings.json and newsrooom_videos.json" but the commit message and content include dashboard. Cosmetic; consumers reading only the title miss the dashboard change.
- **Typo: `newsrooom_videos.json`.** Three 'o's, both in the commit message and the actual filename. Deliberate — the site consumes this exact filename.
- **Meetings script reads a 130-day window.** The Calendar query is `now-100 days` to `now+30 days`. Older/further events are dropped.
- **Newsroom videos are capped at 5.** `maxResults: '5'` in the YouTube search — increasing requires code + a review of the frontend consumer.
- **Dashboard reads 30-day resets.** The GraphQL script has adaptive rate-limit backoff — a single run can pause up to 15 minutes waiting for the primary rate limit to reset (see `dashboard/rate-limiting-and-retries.md`).

## Related topics
- [`content-generation/README.md`](../content-generation/README.md) — meetings and videos scripts, and their build-time siblings
- [`dashboard/README.md`](../dashboard/README.md) — dashboard generator and frontend
- [`README.md`](./README.md) — parent, shared workflow patterns
