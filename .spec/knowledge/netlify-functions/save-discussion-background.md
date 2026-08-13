# save-discussion-background function
> Created: 2026-05-25 | Updated: 2026-05-25

## What this topic covers

The background function at `netlify/functions/save-discussion-background/` — invoked by a Slack "Save Discussion" message action, it archives a Slack thread as a GitHub Discussion under a maintainer-selected category, preserving replies (and the "answer" marker) as reply structure.

## Key files

| File | Role |
|------|------|
| `netlify/functions/save-discussion-background/index.ts` | Handler — routes between `message_action` and `dialog_submission` Slack payloads |
| `netlify/functions/save-discussion-background/Reposity.ts` | GitHub Discussions GraphQL client (`getDiscussionCategories`, `getRepositoryId`, `createDiscussion`, `createDicussionReply`, `markAnswer`) — note the typo in the filename |
| `netlify/functions/save-discussion-background/Slack.ts` | Slack API wrapper — `getSlackDiscussion`, `openSaveDialog`, `sendResponse` |
| `netlify/functions/save-discussion-background/helpers.ts` | Shared helpers |
| `netlify/functions/save-discussion-background/index.d.ts` | Type declarations |

## How it works

### Slack integration
The function is registered as a Slack "message action" in the AsyncAPI Slack workspace. When a maintainer clicks "Save Discussion" on a threaded message, Slack POSTs a payload to this function.

### Request types
Slack sends two types of payloads to this endpoint:

1. **`message_action`** — first click, opens the save dialog
2. **`dialog_submission`** — user submitted the dialog, do the actual save

Payload parse:
```typescript
const payload = JSON.parse(querystring.parse(event.body || '{}')?.payload as string);
```

Slack encodes the body as `application/x-www-form-urlencoded` with a `payload` field containing a JSON string. Two parses required.

### Path 1 — `message_action`
```typescript
async function handleMessageAction(payload) {
  const threadTS = payload.message.thread_ts;
  if (!threadTS) {
    // Not a threaded message → error out to the user
    await Slack.sendResponse(payload.response_url, 'Unable to save this discussion since it has no replies.');
    return;
  }

  const discussionCategories = await Repository.getDiscussionCategories(REPO_OWNER, REPO_NAME);
  const state = `${payload.channel.id} ${threadTS}`;
  await Slack.openSaveDialog(state, discussionCategories, payload.trigger_id);
}
```

1. Reject standalone messages (no thread → nothing to save)
2. Fetch available discussion categories from the target repo (via `Reposity.ts::getDiscussionCategories`)
3. Encode `channelId threadTS` as opaque `state` — Slack passes this back with the dialog submission
4. Open a Slack dialog listing the categories via `openSaveDialog(state, categories, triggerId)`

### Path 2 — `dialog_submission`
```typescript
async function handleDialogSubmission(payload) {
  const [channelId, threadTS] = payload.state.split(' ');
  const discussion = await Slack.getSlackDiscussion(channelId, threadTS);
  if (!discussion) return;
  discussion.title = payload.submission.title;

  const repositoryId = await Repository.getRepositoryId(REPO_OWNER, REPO_NAME);
  const { discussionId, discussionURL } = await Repository.createDiscussion(
    discussion,
    repositoryId,
    payload.submission.category,
    discussion.slackURL || ''
  );

  if (discussion.replies) {
    for (const reply of discussion.replies) {
      const replyId = await Repository.createDicussionReply(discussionId, reply);
      if (reply.isAnswer) {
        await Repository.markAnswer(replyId);
      }
    }
  }
}
```

1. Reconstruct `channelId` + `threadTS` from the state string
2. Fetch the Slack thread as a `discussion` object (parent + replies, with `isAnswer` flags)
3. Overwrite the discussion's title with the user's dialog input
4. Resolve the target GitHub repo's node ID
5. Call `Repository.createDiscussion(discussion, repositoryId, categoryId, slackURL)` — creates the parent GitHub Discussion
6. For each Slack reply: create a GitHub Discussion reply
7. If a reply was marked as the answer in Slack, call `Repository.markAnswer(replyId)` on GitHub

### Background-function semantics
Netlify recognises the `-background` folder suffix and:
- Returns 202 to Slack immediately (Slack times out at 3 seconds; the actual GitHub calls take much longer)
- Runs the function up to 15 minutes
- Provides no response body to the caller

If Slack needs to be notified after completion, the function must use `response_url` (a Slack-provided webhook) — as done in the error-message path.

## Configuration

| Env var | Purpose |
|---|---|
| `DISCUSSION_TARGET_REPO_OWNER` | GitHub repo owner (typically `asyncapi`) |
| `DISCUSSION_TARGET_REPO_NAME` | Target repo name (typically `community`) |
| Slack signing secret / bot token | Auth for Slack API calls (in `Slack.ts`) |
| GitHub token with discussion-write | Auth for GitHub GraphQL (in `Reposity.ts`) |

## Common gotchas

- **`Reposity.ts` typo.** Filename is `Reposity.ts`, not `Repository.ts`. Import statements must match — renaming breaks imports if any external file references it (currently none).
- **`createDicussionReply` typo** — missing 's' in Discussion. Preserved for consistency with the export.
- **State encoding uses space as delimiter.** `${channelId} ${threadTS}` — if either field contains a space (they shouldn't, per Slack format), the split breaks. Fragile.
- **`response_url`** is only used for the error path (`sendResponse`). The success path is silent — Slack shows "action complete" but no confirmation link to the created Discussion.
- **Background function 202** confuses Slack diagnostics — Slack sees an immediate ACK and can't tell if the actual GitHub operation succeeded.
- **Failure inside `handleDialogSubmission` is not user-visible.** Errors are logged only. Watch Netlify function logs.
- **Discussion categories are fetched every message-action click.** Not cached. Adds a GraphQL call to each dialog open — usually fine, but repeated rapid clicks hit rate limits.
- **`isAnswer` flag preservation.** Slack replies that were marked as thread answers become GitHub Discussion answers. Standard replies do not.

## Related topics
- [`README.md`](./README.md) — parent chapter
- [`github-discussions.md`](./github-discussions.md) — a different (non-background) function that also creates discussions but from a website Feedback card
