# PR automation workflows
> Created: 2026-05-25 | Updated: 2026-05-25

## What this topic covers

Workflows that automate the PR lifecycle: automatic merging (via labels), autoupdating branches, PR title linting, notifications, and stale PR/issue management. Also covers the periodic sync of shared workflow files from `asyncapi/.github`.

## Key files

| Workflow | Purpose |
|---|---|
| `.github/workflows/automerge.yml` | Auto-merges Dependabot PRs when checks pass |
| `.github/workflows/automerge-orphans.yml` | Handles bot PRs whose base branch has moved |
| `.github/workflows/automerge-for-humans-merging.yml` | Auto-merges human PRs that carry a `ready-to-merge` label and pass checks |
| `.github/workflows/automerge-for-humans-add-ready-to-merge-or-do-not-merge-label.yml` | Adds `ready-to-merge` / `do-not-merge` labels via PR comment commands |
| `.github/workflows/automerge-for-humans-remove-ready-to-merge-label-on-edit.yml` | Removes the `ready-to-merge` label whenever a PR is edited (safety) |
| `.github/workflows/autoupdate.yml` | Keeps PR branches up-to-date with base |
| `.github/workflows/update-pr.yml` | Broader PR update flow (used for community-generated PRs) |
| `.github/workflows/lint-pr-title.yml` | Enforces Conventional Commits format on PR titles |
| `.github/workflows/stale-issues-prs.yml` | Marks + closes stale issues and PRs |
| `.github/workflows/update-maintainers-trigger.yaml` | Kicks off the maintainer-list refresh from the org config |

## How it works

### Merge gating by label
- `ready-to-merge` — the human/bot signal that the PR is ready. Presence + green checks trigger automerge.
- `do-not-merge` — the default label on bot-opened PRs (from `regenerate-*.yml`). Automerge respects this.
- The label state is enforced by the `add-...-label` and `remove-...-label-on-edit` workflows.

### Autoupdate
- `autoupdate.yml` uses the `docker://chinthakagodawita/autoupdate-action:v1` container to keep PR branches ahead of base.
- `update-pr.yml` is a more elaborate flow that handles PRs that need CODEOWNERS review before update.

### PR title lint
- `lint-pr-title.yml` uses `amannn/action-semantic-pull-request` with the AsyncAPI-org Conventional Commits scope list.
- A failing lint blocks merge until the title is fixed.

### Stale management
- `stale-issues-prs.yml` uses the standard `actions/stale` action. Marks stale after 60 days of inactivity, closes after another 7.

### Notifications
- Complementary notification workflows live under `community-and-notifications.md`.

## Configuration

| File / Var | Role |
|---|---|
| Repo labels | Manual labels `ready-to-merge`, `do-not-merge`, `stale`, `dependencies` etc. |
| `PAT_GH_TOKEN` | Some workflows need a PAT (not `GITHUB_TOKEN`) for actions that touch the org level |
| `.github/workflows/scripts/` | Shared helper scripts referenced by multiple workflows |

## Common gotchas

- **`do-not-merge` label is the safety hook.** Anything opened by a bot ships with it. Automerge honours it — do not accidentally remove it during grooming.
- **`autoupdate` container action** is pinned to a Docker image tag, not a SHA; the image can drift.
- **Human `ready-to-merge`** requires a fresh addition after every edit — the `remove-...-on-edit` workflow explicitly strips it whenever the PR is modified.
- **Semantic PR title scopes** are org-wide. Adding a new scope requires editing the workflow config.
- **Stale action skips labels** — PRs with the `pinned` or `security` label are not staled.

## Related topics
- [`README.md`](./README.md) — parent, includes the label conventions across the workflow set
- [`regenerate-tools/workflow-and-pr.md`](./regenerate-tools/workflow-and-pr.md) — where `do-not-merge` originates for the weekly tools PR
