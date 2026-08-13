# Deployment — asyncapi/website
> Created: 2026-05-25 | Updated: 2026-05-25

## Hosting
Netlify. Auto-deploys `master` on merge. Preview deploys per-PR.

## Build
- `npm run build` runs `next build` after generating tools/meetings/videos JSON.
- `netlify.toml` controls build environment and headers.
- Edge functions in `netlify/edge-functions/`.

## Weekly automations
See the `workflows` chapter for detailed coverage of every scheduled workflow.

At a high level:
| Workflow | Purpose | Output committed via PR |
|---|---|---|
| `.github/workflows/regenerate-tools.yml` | Rebuild tools directory from GitHub `.asyncapi-tool` files | `config/tools*.json`, `config/all-tags.json` |
| `.github/workflows/regenerate-meetings-and-videos.yml` | Refresh meetings + videos from external sources | `config/meetings.json`, `config/newsroom_videos.json` |

Both create PRs via `peter-evans/create-pull-request`. Maintainers approve manually.

## Environment variables
- `GITHUB_TOKEN` / `GH_TOKEN` — used by workflow-invoked scripts to hit the GitHub API
- Netlify env vars for prod build (API keys for newsletter, discussions)

## Rollback
Netlify's "Publish deploy" UI can revert to a previous successful deploy in <1 minute.
