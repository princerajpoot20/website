# regenerate-tools workflow
> Created: 2026-05-25 | Updated: 2026-05-25

## What this topic covers

The scheduled GitHub Actions workflow that runs the tools generation pipeline weekly and opens a PR with the regenerated JSON files. For details of what the pipeline actually does, see [`content-generation/tools/README.md`](../content-generation/tools/README.md).

## Key files

| File | Role |
|------|------|
| `.github/workflows/regenerate-tools.yml` | Workflow definition (cron + workflow_dispatch) |
| `package.json` (`generate:tools` script) | Invoked in step 5 — runs `tsx scripts/build-tools.ts` |

## How it works

### 1. Triggers
- **Schedule** — `cron: "15 0 * * 1"` — 00:15 UTC every Monday
- **Manual** — `workflow_dispatch` for on-demand regeneration by maintainers

### 2. Guard
```yaml
if: github.repository == 'asyncapi/website'
```
The workflow only runs on the canonical repo, not on forks.

### 3. Steps
1. **Checkout** — `actions/checkout@v3`
2. **Resolve Node version** — `asyncapi/.github/.github/actions/get-node-version-from-package-lock@master` reads the version from `package-lock.json`
3. **Set up Node** — `actions/setup-node@v3` with npm cache keyed on `**/package-lock.json`
4. **Install** — `npm install`
5. **Regenerate** — `npm run generate:tools` (invokes `scripts/build-tools.ts`)
6. **Open PR** — `peter-evans/create-pull-request` pinned by commit SHA (equivalent to release tag `v4.2.4`)
7. **On failure** — `8398a7/action-slack` pinned by SHA notifies the `94_bot-failing-ci` channel

### 4. PR shape
The PR opened by `peter-evans/create-pull-request` has:

| Field | Value |
|---|---|
| `commit-message` | `chore: update tools.json` |
| `committer` / `author` | `asyncapi-bot <info@asyncapi.io>` |
| `title` | `chore: update tools.json` |
| `body` | Ping to `@asyncapi/website-maintainers` asking them to review; a hint to check workflow run logs for any ignored-tools summary |
| `labels` | `do-not-merge` |
| `branch` | `update-tools/${{ github.job }}` (i.e. `update-tools/regenerateTools`) |

The `do-not-merge` label is a safety measure — the PR sits until a maintainer manually swaps it (e.g. for `ready-to-merge`).

### 5. Environment / secrets
- `GITHUB_TOKEN` env var is set at the job level to `${{ secrets.GH_TOKEN }}` — this is the org-scoped token, needed both for the GitHub code-search API call in the script and for `peter-evans/create-pull-request` to open the PR.
- `SLACK_WEBHOOK_URL` for the failure Slack step is `${{ secrets.SLACK_CI_FAIL_NOTIFY }}`.

### 6. Safety model — why manual approval

Historically the tools list was fetched from the GitHub API and displayed on the site without human intervention. Because the input (`.asyncapi-tool` files) is world-writeable — anyone can create a repo with a `.asyncapi-tool` file — the pipeline is treated as ingesting user-controlled content.

The manual `do-not-merge` gate exists so a maintainer eyeballs each week's PR before it ships. The reviewer's job is to spot anything abusive or off-brand added since last week.

## Configuration

| Setting | Where |
|---|---|
| Schedule | `on.schedule.cron` in the workflow file |
| Node version | Derived from `package-lock.json` — no manual override |
| Author / committer | `peter-evans/create-pull-request` params |
| PR base branch | Repo default (`master`) — not explicitly set |

## Common gotchas

- **Cron is UTC.** `"15 0 * * 1"` is Monday 00:15 UTC, which is late Sunday US Pacific — not the same as "start of the week" for maintainers.
- **Pinned SHAs drift.** The `peter-evans/create-pull-request` SHA in the file corresponds to `v4.2.4`; newer releases exist. Upgrading requires re-pinning both the SHA and the comment describing the release.
- **`update-tools/${{ github.job }}` branch name** — since the job name is `regenerateTools`, the branch is always `update-tools/regenerateTools`. If the job name changes, the branch name changes (and PRs get orphaned).
- **`do-not-merge` blocks auto-merge** only if the repo's automerge workflows honour that label. See [`pr-automation.md`](./pr-automation.md) for how the automerge chain handles labels.
- **No cache invalidation on manual dispatch.** A `workflow_dispatch` run does the full fetch just like the scheduled one.
- **Fork PRs' workflow runs.** Because of the `if:` guard, PRs opened from forks don't trigger this workflow. Testing changes to the workflow requires either merging to `master` or dispatching from a branch inside the canonical repo.

## Related topics
- [`content-generation/tools/README.md`](../content-generation/tools/README.md) — the pipeline this workflow runs
- [`README.md`](./README.md) — parent chapter, shared workflow patterns
- [`pr-automation.md`](./pr-automation.md) — label conventions across workflows
