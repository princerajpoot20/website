# github-discussions function
> Created: 2026-05-25 | Updated: 2026-05-25

## What this topic covers

The regular Netlify function at `netlify/functions/github_discussions.ts` — creates a GitHub Discussion in the AsyncAPI community repo's "Docs" category via GraphQL. Powers the site's per-docs-page Feedback card ("Was this page helpful? Send feedback").

## Key files

| File | Role |
|------|------|
| `netlify/functions/github_discussions.ts` | The handler. Single POST endpoint. |

## How it works

### 1. Method gate
```typescript
if (event.httpMethod === 'POST') { ... }
else return { statusCode: 500, body: { message: 'The specified HTTP method is not allowed.' } };
```

Only POST is handled. Non-POST returns 500 (arguably should be 405, but current shape).

### 2. Parse body
```typescript
const { title, feedback } = JSON.parse(event.body || '');
```

Expects `{ title: string, feedback: string }`. No schema validation — malformed JSON throws, caught by the outer catch and returned as an error response.

### 3. Fixed target
Two constants at module scope identify where the Discussion lands:

```typescript
const repositoryID: string = 'MDEwOlJlcG9zaXRvcnkzNDc2MjE1NTk=';   // asyncapi/community
const categoryID: string = 'DIC_kwDOFLhIt84B_T4d';                 // "Docs" category in that repo
```

These are GraphQL node IDs (opaque base64-ish strings), not the numeric REST IDs.

### 4. GraphQL mutation
```typescript
const createDiscussion = await graphql(`
  mutation {
    createDiscussion(input:{
      repositoryId:"${repositoryID}",
      categoryId:"${categoryID}",
      title:"${title}",
      body:"${feedback}"
    }){
      discussion {
        url
      }
    }
  }
`, {
  owner: 'asyncapi',
  repo: 'community',
  headers: {
    authorization: `token ${process.env.GITHUB_TOKEN_CREATE_DISCUSSION}`
  }
});

const { url } = createDiscussion.createDiscussion.discussion;
```

Uses `@octokit/graphql`. The token is a *separate* GitHub token from other functions — permissioned for discussion-write on `asyncapi/community`.

### 5. Response
Success (200):
```json
{ "url": "https://github.com/asyncapi/community/discussions/1234", "message": "Feedback submitted successfully" }
```

Failure — passes through GitHub's error status + message:
```typescript
return {
  statusCode: error.response.status,
  message: error.response.data.message,
};
```

Note: the failure response returns `message` at top level rather than in `body` — a subtle inconsistency with the success shape.

## Configuration

| Env var | Purpose |
|---|---|
| `GITHUB_TOKEN_CREATE_DISCUSSION` | Auth token with write access to `asyncapi/community` Discussions. |

Module-level constants:
- `repositoryID` — pinned to `asyncapi/community`
- `categoryID` — pinned to the Docs category

## Common gotchas

- **String interpolation into GraphQL is a GraphQL injection risk.** Untrusted `title` / `feedback` are interpolated directly. Quotes or newlines in user input can break the mutation or (with effort) alter it. Should be parameterised via `$title: String!` and `$body: String!` variables.
- **`event.body` may be null.** `JSON.parse('')` throws — caught by outer try, returns error. But error response format is inconsistent.
- **500 for wrong method.** Should be 405 Method Not Allowed. Not corrected — clients treat it as opaque failure.
- **Success shape vs failure shape mismatch.** Success has JSON `body` with `url` + `message`. Failure has top-level `message` (no `body`). Consumers must check `statusCode` first, then branch on shape.
- **Fixed repo and category** mean the function can't be reused for other repos without code changes.
- **`categoryID`** must match the target repo's Docs category node ID. If the category is renamed or restructured on GitHub, this ID can become invalid.
- **No rate-limit awareness.** A burst of feedback submissions can trip GitHub's abuse detection. No retry logic.
- **CORS**: not visible in this file — must be set in `netlify.toml` (or an equivalent function-response header) if the client is on a different origin.

## Related topics
- [`README.md`](./README.md) — parent chapter
- `../workflows/quality-and-testing.md` — no dedicated test workflow for this function; ships with the site
