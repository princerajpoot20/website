# Community and notification workflows
> Created: 2026-05-25 | Updated: 2026-05-25

## What this topic covers

Workflows that handle community engagement: welcoming first-time contributors, labelling good-first-issues, notifying triagers and TSC members, running bounty and micro-grant slash commands, sending Slack notifications, and posting release announcements.

## Key files

| Workflow | Purpose |
|---|---|
| `.github/workflows/welcome-first-time-contrib.yml` | Comments a welcome message on first-time contributor PRs/issues |
| `.github/workflows/add-good-first-issue-labels.yml` | Auto-labels newly-opened issues that match "good first issue" heuristics |
| `.github/workflows/notify-triager.yml` | Pings triagers when a new issue lands unlabelled |
| `.github/workflows/notify-tsc-members-mention.yml` | Notifies TSC members when they're mentioned |
| `.github/workflows/issues-prs-notifications.yml` | Aggregates issue/PR events for Slack |
| `.github/workflows/slack-notification.yml` | Generic Slack notification workflow, reusable via inputs |
| `.github/workflows/release-announcements.yml` | Announces new releases to Slack and social channels |
| `.github/workflows/bounty-program-commands.yml` | Slash-command handler for the bounty programme |
| `.github/workflows/microgrant-program-commands.yml` | Slash-command handler for the micro-grant programme |
| `.github/workflows/please-take-a-look-command.yml` | Slash command that pings the CODEOWNERS of a PR |
| `.github/workflows/help-command.yml` | Slash command that responds with help text |

## How it works

- **Trigger patterns** — `issue_comment`, `pull_request_target`, `issues` events.
- **Slash commands** — parse the leading `/command` from issue/PR comments, dispatch to the appropriate workflow via the `commands` filter.
- **Reusable Slack** — `slack-notification.yml` is invoked by others via `workflow_call` (or by hand where needed).
- **Bounty / micro-grant flows** talk to external systems (labels + spreadsheet / config JSON updates).

## Configuration

| Var | Purpose |
|---|---|
| `SLACK_WEBHOOK_URL` | Slack webhook for the relevant channel |
| `GH_TOKEN` | Cross-repo actions (e.g. reading the maintainers config in `asyncapi/community`) |
| `BOUNTY_PROGRAM_TOKEN` / config paths | Bounty and micro-grant workflows read config sources for eligibility |

## Common gotchas

- **`pull_request_target` runs from base, not PR head** — safer for privileged actions but easy to forget when you also want to run PR-authored code.
- **Slash commands are case-sensitive.**
- **Slack webhooks are per-channel.** Rotating a webhook requires updating the secret in Repo settings.
- **`please-take-a-look`** notifies the CODEOWNERS of the changed files — accuracy depends on `CODEOWNERS` being up-to-date.
- **`release-announcements`** relies on the release having a properly-formatted title and body.

## Related topics
- [`pr-automation.md`](./pr-automation.md) — labelling and merge workflows
- [`README.md`](./README.md) — parent, patterns shared across workflows
