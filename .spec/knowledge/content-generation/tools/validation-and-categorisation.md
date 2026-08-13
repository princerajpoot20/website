# Validation and categorisation
> Created: 2026-05-25 | Updated: 2026-05-25

## What this topic covers

What happens to each downloaded `.asyncapi-tool` file after fetch: JSON Schema validation, fuzzy category matching, and placement into the automated tools object. Everything in `scripts/tools/tools-object.ts::convertTools`.

## Key files

| File | Role |
|------|------|
| `scripts/tools/tools-object.ts` | Owns `convertTools` (the automated path) and `createToolObject` (shape for both automated and manual). |
| `scripts/tools/tools-schema.json` | JSON Schema every tool file must validate against. |
| `scripts/tools/categorylist.ts` | Canonical category list (`APIs`, `Code Generators`, `Editors`, `Others`, etc.). Each has `name`, `tag`, `description`. |

## How it works

### 1. Initialise the result shape
`convertTools` seeds `finalToolsObject` as an object keyed by category name (from `categorylist.ts`). Each value is `{ description, toolsList: [] }`. Any tool that doesn't match a known category falls through to `Others`.

### 2. Per-tool processing (via `Promise.all`)
For each item returned by `getData` whose `name` starts with `.asyncapi-tool`:

**a. Download and parse.** See [`fetching.md`](./fetching.md) step 5.

**b. Schema validation.** The parsed object is validated against `tools-schema.json` via Ajv. If invalid, the pipeline **does not throw** — it logs a warning like:

> "Script is not failing, it is just dropping errors for further investigation.\nInvalid .asyncapi-tool file.\nLocated in: {tool.html_url}.\nValidation errors: {ajv errors}"

and skips the tool. This tolerance is intentional; a single malformed tool must not break the weekly workflow.

**c. Build the tool object.** `createToolObject` is called with the parsed file, the repo's `html_url` (as fallback for `links.repoUrl`), the repo's `description` (as fallback for the tool's `description`), and a boolean `isAsyncAPIrepo` (`true` when `tool.repository.owner.login === 'asyncapi'`).

`createToolObject` returns a normalised shape:
```typescript
{
  title,
  description,
  links: { ...toolFile.links, repoUrl: repoUrl-with-fallback },
  filters: {
    ...toolFile.filters,
    hasCommercial: toolFile.filters.hasCommercial ?? false,
    isAsyncAPIOwner: isAsyncAPIrepo,
  }
}
```

**d. Category placement.** The `categorylist` is used as a Fuse index (fuzzy match on the `tag` field, `threshold: 0.4`). For each `category` string in the tool file's `filters.categories`:

- `fuse.search(category)` runs
- The best match's `name` is used as the target category — or `'Others'` when no match
- The tool object is pushed into `finalToolsObject[targetCategory].toolsList` **unless** the same object reference is already present (`if (!toolsList.includes(toolObject))`)

Tools with multiple valid categories therefore appear in every matching category's `toolsList`.

### 3. Return
`convertTools` returns the fully-populated `finalToolsObject`, which `build-tools.ts` writes as `config/tools-automated.json` and passes into `combineTools`.

## Configuration

| File | Purpose |
|---|---|
| `scripts/tools/tools-schema.json` | Contract for `.asyncapi-tool` file authors. |
| `scripts/tools/categorylist.ts` | Adding/renaming a category changes fuzzy-match targets and can move tools to `Others`. |

## Common gotchas

- **Fuzzy threshold 0.4** — reasonably tolerant. Unusual category strings (typos, alt spellings) usually still match; badly wrong ones fall through to `Others`.
- **Silent validation failures** — invalid tool files log a warning and are dropped. Look at CI logs to find failing tools. There is no failure count in the output.
- **Multiple categories per tool** — tools legitimately appear in more than one category's `toolsList`. Counts of "total tools" should dedupe by title or repoUrl if the caller needs a unique count.
- **Category name vs tag** — `categorylist.ts` distinguishes `name` (display) from `tag` (matched against tool metadata). Fuse indexes `tag`.
- **`isAsyncAPIrepo` for manual tools** — computed differently. In `combine-tools.ts::processManualTool`, a manual tool is `isAsyncAPIrepo` if its `links.repoUrl` starts with `https://github.com/asyncapi/`.

## Related topics
- [`fetching.md`](./fetching.md) — where the input items come from
- [`combining-automated-and-manual.md`](./combining-automated-and-manual.md) — how the automated tools object is merged with manual entries
- [`output-files.md`](./output-files.md) — the shape written to `config/tools-automated.json`
