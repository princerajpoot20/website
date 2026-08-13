# Markdown quality checks
> Created: 2026-05-25 | Updated: 2026-05-25

## What this topic covers

Two validators under `scripts/markdown/` that run in CI to catch content problems before merge:

- `check-markdown.ts` — validates the front-matter of every doc and blog MDX file
- `check-edit-links.ts` — walks every doc MDX, computes the "edit this page on GitHub" URL, and HEADs it to catch 404s

## Key files

| File | Role |
|------|------|
| `scripts/markdown/check-markdown.ts` | Owns `checkMarkdownFiles`, `validateBlogs`, `validateDocs`, `isValidURL` |
| `scripts/markdown/check-edit-links.ts` | Owns `main`, `generatePaths`, `checkUrls`, `processBatch`, `determineEditLink` |
| `config/edit-page-config.json` | Maps doc URL prefixes to their upstream GitHub repos/branches |
| `.github/workflows/check-edit-links.yml` | Invokes `check-edit-links.ts` on PR |

## How each works

### `check-markdown.ts` — front-matter validation

`main()` runs `checkMarkdownFiles` twice in parallel — once for `markdown/docs`, once for `markdown/blog` — with different validator functions.

**`checkMarkdownFiles(folderPath, validateFunction, relativePath)`**
Recursively walks `folderPath`:
- Skips any path under `reference/specification/` (specification files have their own validation)
- Skips directories that are not files
- For `.md` files: reads content, parses front-matter via `gray-matter`, calls `validateFunction(frontmatter)`
- If the validator returns errors, logs each error prefixed with the file's relative path, and sets `process.exitCode = 1` (so the process exits non-zero at end)

**`validateDocs(frontmatter)`** — minimal:
- `title` must exist and be a string
- `weight` must exist and be a number

**`validateBlogs(frontmatter)`** — more thorough:
- Required attributes: `title`, `date`, `type`, `tags`, `cover`, `authors`
- `date` must parse as a valid date (`!Number.isNaN(Date.parse(date))`)
- `tags` must be an array
- `cover` must be a string
- `authors` must be an array. Each author needs `name` and `photo`; `link` (if present) must be a valid URL (via `isValidURL`, which just constructs `new URL(str)` and catches)

Errors are collected and returned as an array; `null` = valid.

### `check-edit-links.ts` — 404 checker

**`main()`** reads `config/edit-page-config.json` (aliased as `editUrls`), resolves the docs folder path, calls `generatePaths` to enumerate every doc MDX file and derive its edit-link, then `checkUrls` to HEAD each in batches.

**`generatePaths(folderPath, editOptions, relativePath, result)`**
Recursively walks `folderPath`:
- Skips `_section.md` files
- On a directory: recurses
- On a `.md` file: computes `urlPath = relativeFilePath.split(sep).join('/').replace('.md', '')` and generates an edit link via `determineEditLink`
- Pushes `{ filePath, urlPath, editLink }` to `result`

**`determineEditLink(urlPath, filePath, editOptions)`**
- Strips leading `docs/` from `urlPath` for matching
- Finds the first `editOptions` entry whose `value` is included in the stripped path
- If the matched option has an empty `value` (fallback), returns `${target.href}/docs/${urlPath}.md`
- Otherwise returns `${target.href}/${basename(filePath)}`
- No match → `null`

**`checkUrls(paths)`**
Splits `paths` into batches (default 5, override via `DOCS_LINK_CHECK_BATCH_SIZE`). Processes batches in parallel via `Promise.all(batches.map(...))`. Each batch:
- Calls `processBatch(batch)`
- Pauses 1000 ms
- Filters out `null` results (non-404 links)

The final `Promise.all` result is flattened and returned — the array of `PathObject`s whose edit URL returned 404.

**`processBatch(batch)`**
For each entry:
- Skips if `editLink` is null or if `filePath` ends with any entry in `ignoreFiles` (`v2.x.md`, `v3.0.0-explorer.md`, `v3.0.0.md`)
- Creates an `AbortController` with `TIMEOUT_MS` (default 5000, override `DOCS_LINK_CHECK_TIMEOUT`)
- `fetch(editLink, { method: 'HEAD', signal: controller.signal })`
- If `status === 404`, returns the entry; otherwise returns `null`
- On any fetch error, rejects with `"Error checking {url}: {error}"`
- Always clears the timeout in `finally`

Results are logged: either "All URLs are valid." or a bullet list of invalid URLs plus a count.

## Configuration

| Var / file | Purpose |
|---|---|
| `config/edit-page-config.json` | Maps doc paths to upstream repo edit-URL templates. Shape: `[{ value: string, href: string }]` |
| `DOCS_LINK_CHECK_BATCH_SIZE` env | Batch size for HEAD requests (default 5) |
| `DOCS_LINK_CHECK_TIMEOUT` env | Per-request timeout ms (default 5000) |
| `ignoreFiles` const | Paths in `check-edit-links.ts` never checked (spec files that live outside the normal repo layout) |

## Common gotchas

- **`process.exitCode = 1` vs `throw`.** `check-markdown.ts` uses `exitCode` so all files get logged before exit. Reading stderr during a workflow run tells you which files broke.
- **Empty-value editOptions.** The fallback case (`target?.value === ''`) uses a different URL template — `${href}/docs/${urlPath}.md` — than the specific case (`${href}/${basename}`). Configuration errors here silently point to wrong repos.
- **`ignoreFiles` matches on path suffix**, not full path. Files with the same trailing path in a different subdirectory will also be skipped.
- **`_section.md` (docs-nav metadata)** is skipped by `check-edit-links.ts` but NOT by `check-markdown.ts` — the two validators disagree on what counts. In practice `_section.md` should not have blog-style front-matter, so `validateBlogs` complains.
- **HEAD request timeouts** can create false positives on flaky external sites. Retries not built in — a single 5s timeout fails the URL.
- **`main` in `check-edit-links.ts` uses `logger.info` for both success and failure output.** Failures also set no exit code — the workflow determines failure by parsing the output.

## Related topics
- [`README.md`](./README.md) — parent chapter
- `../workflows/quality-and-testing.md` — CI wiring for these checks
