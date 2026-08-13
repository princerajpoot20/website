# Combining automated and manual tools
> Created: 2026-05-25 | Updated: 2026-05-25

## What this topic covers

The merge stage. How the automated `ToolsListObject` produced by `convertTools` is joined with the hand-authored `tools-manual.json`, filtered by `tools-ignore.json`, enriched with language/technology tag data (see [`tags-and-colors.md`](./tags-and-colors.md)), and written to `config/tools.json`. Everything in `scripts/tools/combine-tools.ts::combineTools`.

## Key files

| File | Role |
|------|------|
| `scripts/tools/combine-tools.ts` | Owns `combineTools`, `shouldIgnoreTool`, `getFinalTool`, `processManualTool`. |
| `config/tools-manual.json` | Hand-authored tools grouped by category (same shape as automated). Overrides / extends the automated set. |
| `config/tools-ignore.json` | Ignore rules — a `tools` array where each entry has some subset of `{ title, repoUrl, categories, reason }`. |

## How it works

### 1. Load the ignore list
If `ignorePath` is provided and the file exists, `combineTools` reads and parses it into an `ignoreList` (array of `ToolIgnoreEntry`). Entries missing both `title` and `repoUrl` are silently skipped later during matching.

### 2. Iterate categories from the automated set
`combineTools` walks the keys of the incoming `automatedTools` object. For each category `key`:

**a. Filter automated tools against the ignore list.**
`shouldIgnoreTool(tool, key, ignoreList)` matches each tool against every ignore entry. An entry matches when:
- Its `title` (if provided) matches the tool's title exactly, AND
- Its `repoUrl` (if provided) matches the tool's `links.repoUrl` exactly, AND
- Its `categories` (if provided) contains the current category

Ignored tools are pushed onto an `ignoredTools` audit list (with `title`, `repoUrl`, `reason`, `category`, `source: 'automated'`, `ignoredAt`).

**b. Enrich each remaining automated tool.**
`getFinalTool` is mapped over the filtered list via `Promise.all`. `getFinalTool` runs Fuse searches to resolve `filters.language` and `filters.technology` from strings/arrays of strings into `LanguageColorItem[]` objects (with `name`, `color`, `borderColor`). See [`tags-and-colors.md`](./tags-and-colors.md) for details.

**c. Filter the manual list for this category** using the same `shouldIgnoreTool` logic. Ignored manual tools are also pushed to `ignoredTools` with `source: 'manual'`.

**d. Enrich each remaining manual tool** via `processManualTool`, which:
- Runs schema validation (same schema as automated). Invalid manual tools are logged and dropped (returns `null`).
- Sets `isAsyncAPIrepo` based on whether `links.repoUrl` starts with `https://github.com/asyncapi/`.
- Calls `createToolObject` to normalise the shape.
- Passes the result through `getFinalTool` for language/technology enrichment.

**e. Concatenate and sort.**
The enriched automated results and enriched manual results are concatenated into `[...automatedResults, ...manualResults]` and sorted before assignment to `finalTools[key].toolsList`. The current sort is:

```typescript
[...automatedResults, ...manualResults].sort((tool, anotherTool) => {
  if (!tool?.title || !anotherTool?.title) {
    logger.error({
      message: 'Tool title is missing during sort',
      detail: { tool, anotherTool },
      source: 'combine-tools.ts',
    });
    return 0;
  }
  return tool.title.localeCompare(anotherTool.title);
});
```

The sort key is `title` via `localeCompare` (default locale, default sensitivity).

### 3. Write the final tools JSON
`fs.writeFileSync(toolsPath, JSON.stringify(finalTools, null, 2))` writes `config/tools.json` — the frontend's source of truth for the tools directory.

### 4. Write `all-tags.json`
See [`tags-and-colors.md`](./tags-and-colors.md) for the `languageList` and `technologyList` details. `combineTools` writes:

```typescript
{
  languages: languageList,
  technologies: technologyList,
}
```

to `config/all-tags.json`.

### 5. Write the ignored-tools audit log
If `ignoredOutputPath` is provided:
- If any tools were ignored, writes the audit object (`description`, `generatedAt`, `totalIgnored`, `ignoredTools`).
- If no tools were ignored, writes an empty audit (`totalIgnored: 0`, `ignoredTools: []`).

Also logs a summary line to the logger — either "Tools ignored: N tool(s) removed by M ignore rule(s)" (with each entry listed) or "Tools ignored: 0 (none of the M ignore rule(s) matched any tool)".

## Configuration

| File | Purpose |
|---|---|
| `config/tools-manual.json` | Manual tool entries per category |
| `config/tools-ignore.json` | Ignore rules — remove specific tools by title/repoUrl |
| Output paths (`toolsPath`, `tagsPath`, `ignoredOutputPath`) | Passed by `build-tools.ts` — see [`output-files.md`](./output-files.md) |

## Common gotchas

- **Ignore matching is exact** — no wildcards. A `repoUrl` with a trailing slash won't match one without.
- **Silent skip on empty ignore entries** — entries with neither `title` nor `repoUrl` are skipped. Missing both is a config bug that produces no signal.
- **Manual tool validation dropouts** — invalid `tools-manual.json` entries log an error but the script continues. Watch CI logs on the weekly PR to catch them.
- **`processManualTool` awaits inside a map** — it's `Promise.all`ed after the filter, so ordering of the resolved values matches the input array order.
- **`getFinalTool` mutates shared state** — pushes newly-discovered tags onto shared `languageList` / `technologyList` arrays and rebuilds the Fuse indexes. Multiple tools sharing a new tag benefit from this — the second tool sees the tag already in the index.

## Related topics
- [`validation-and-categorisation.md`](./validation-and-categorisation.md) — how the automated input was produced
- [`tags-and-colors.md`](./tags-and-colors.md) — how language/technology enrichment works
- [`output-files.md`](./output-files.md) — the exact JSON shapes on disk
