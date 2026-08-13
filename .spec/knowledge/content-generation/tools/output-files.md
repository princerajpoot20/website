# Output files
> Created: 2026-05-25 | Updated: 2026-05-25

## What this topic covers

The three JSON files the tools pipeline writes to `config/`, their exact shape, when each is written, and who reads them. Includes the audit-log file for ignored tools.

## Key files

| File | Written by | Consumers |
|------|-----------|-----------|
| `config/tools-automated.json` | `build-tools.ts::buildTools` after `convertTools` returns | `build-tools.ts::buildToolsManual` (re-combines from cache without re-fetching GitHub); committed to the repo via the weekly PR |
| `config/tools.json` | `combine-tools.ts::combineTools` at the end | Frontend `pages/tools/*`, search index, tool cards |
| `config/all-tags.json` | `combine-tools.ts::combineTools` at the end | Frontend tag filter UI |
| `config/tools-ignored.json` | `combine-tools.ts::combineTools` at the end (if `ignoredOutputPath` provided) | Audit / debugging — the last-run's ignore audit |

## How each file is produced

### `config/tools-automated.json`
Written after `convertTools` returns from `tools-object.ts`. It is the categorised set of *automated-only* tools, before merge with `tools-manual.json` and before ignore-list filtering. Shape:

```jsonc
{
  "APIs": {
    "description": "The following is a list of APIs...",
    "toolsList": [
      {
        "title": "...",
        "description": "...",
        "links": { "repoUrl": "...", ... },
        "filters": {
          "categories": ["api"],
          "hasCommercial": false,
          "isAsyncAPIOwner": false,
          "language": "TypeScript",
          "technology": ["Node.js"]
        }
      },
      // ...
    ]
  },
  "Code Generators": { ... },
  // ... one entry per category from categorylist.ts
  "Others": { ... }
}
```

Note that at this stage `filters.language` / `filters.technology` are still the raw strings from the tool file — enrichment to `LanguageColorItem[]` happens later inside `combine-tools.ts`.

### `config/tools.json`
Written by `combineTools`. Same top-level shape as `tools-automated.json` (`{ category: { description, toolsList } }`), but:
- Merged with `tools-manual.json` entries
- Filtered by `tools-ignore.json`
- `filters.language` / `filters.technology` are `LanguageColorItem[]` (i.e. `{ name, color, borderColor }`), not strings

This is the file the frontend loads.

### `config/all-tags.json`
Written by `combineTools`. Shape:

```jsonc
{
  "languages": [
    { "name": "Go/Golang", "color": "bg-[#8ECFDF]", "borderColor": "border-[#00AFD9]" },
    { "name": "Java",       "color": "bg-[#ECA2A4]", "borderColor": "border-[#EC2125]" },
    // ...canonical from tags-color.ts...
    // ...then discovered tags appended in the order they were first encountered by getFinalTool...
  ],
  "technologies": [
    { "name": "Node.js",     "color": "bg-[#6DA75D]", "borderColor": "border-[#68A063]" },
    // ...canonical, then discovered
  ]
}
```

Every unique tag that appeared in any tool's `filters.language` / `filters.technology` — whether from the canonical list or discovered on the fly — ends up in this file exactly once.

### `config/tools-ignored.json`
Written by `combineTools` when `ignoredOutputPath` is provided. Shape:

```jsonc
{
  "description": "Auto-generated audit log of tools ignored during the last combine run.",
  "generatedAt": "2026-05-25T00:15:03.221Z",
  "totalIgnored": 3,
  "ignoredTools": [
    {
      "title": "...",
      "repoUrl": "...",
      "reason": "deprecated",
      "category": "APIs",
      "source": "automated",  // or "manual"
      "ignoredAt": "2026-05-25T00:15:03.221Z"
    }
  ]
}
```

When no tools were ignored, `totalIgnored: 0` and `ignoredTools: []`.

## Configuration

Paths are supplied by the caller in `build-tools.ts`:

| Constant | Path (resolved from `scripts/`) |
|---|---|
| `automatedToolsPath` | `../config/tools-automated.json` |
| `manualToolsPath` (input) | `../config/tools-manual.json` |
| `toolsPath` | `../config/tools.json` |
| `tagsPath` | `../config/all-tags.json` |
| `ignorePath` (input) | `../config/tools-ignore.json` |
| `ignoredOutputPath` | `../config/tools-ignored.json` |

All files are pretty-printed via `JSON.stringify(x, null, 2)`.

## Common gotchas

- **All three output JSONs get committed by the weekly PR** — a change to any script that affects any of the three will show up as a diff in that PR.
- **`tools-automated.json` is both output and input** — `buildToolsManual` uses the last committed version when the manual list changes and a re-combine is needed without a fetch. Anything downstream must accept this file as ground truth for the automated set.
- **Pretty-printed output** — 2-space indent. Any modification writing a different indent produces massive diffs.
- **`config/tools-ignored.json` is committed too** — even the empty version. This makes ignore-rule changes visible in code review.

## Related topics
- [`combining-automated-and-manual.md`](./combining-automated-and-manual.md) — how the shapes above are produced
- [`workflow-and-pr.md`](./workflow-and-pr.md) — how the produced files reach the PR
