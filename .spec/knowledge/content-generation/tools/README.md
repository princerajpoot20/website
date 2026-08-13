# Tools generation — Sub-chapter Overview
> Created: 2026-05-25 | Updated: 2026-05-25

## What this sub-chapter covers

The scripts under `scripts/tools/` and `scripts/build-tools.ts` that assemble the tools directory content for asyncapi.com. They discover `.asyncapi-tool` files across every repo on GitHub via code search, download and validate each, categorise them via fuzzy match, merge the result with a hand-authored manual list, resolve per-tool language and technology tag colours, and write three JSON files that the frontend consumes.

Read this sub-chapter for any task touching `scripts/tools/**`, `scripts/build-tools.ts`, or the `config/tools*.json` / `config/all-tags.json` files.

For the scheduled workflow that runs this pipeline weekly and opens a maintainer-review PR, see [`workflows/regenerate-tools.md`](../../workflows/regenerate-tools.md).

## Key files

### Scripts
| File | Role |
|------|------|
| `scripts/build-tools.ts` | Orchestrator. Two entry points: `buildTools` (fetch from GitHub + combine) and `buildToolsManual` (skip fetch, re-combine from cached automated JSON). |
| `scripts/tools/extract-tools-github.ts` | Calls GitHub code-search API for `filename:.asyncapi-tool`, paginates via `incomplete_results`, returns aggregated items. |
| `scripts/tools/tools-object.ts` | Downloads each tool file (raw.githubusercontent), validates against `tools-schema.json`, fuzzy-categorises via Fuse, appends each tool to its category's `toolsList`. Also holds `createToolObject` used by manual tools. |
| `scripts/tools/combine-tools.ts` | Merges `automatedTools` with `manualTools`, applies `tools-ignore.json` filters, calls `getFinalTool` to enrich language/technology filters via Fuse, writes final `tools.json` and `all-tags.json`. |
| `scripts/tools/categorylist.ts` | Canonical category list used for fuzzy category matching. |
| `scripts/tools/tags-color.ts` | Canonical initial languages and technologies with their tag colors. |
| `scripts/tools/tools-schema.json` | JSON Schema each `.asyncapi-tool` file must validate against. |

### Config (input)
| File | Role |
|------|------|
| `config/tools-manual.json` | Hand-authored tools that don't have a repo (or that override automated data). |
| `config/tools-ignore.json` | List of tool titles/repoUrls to skip during combine (e.g. deprecated, spam, or duplicated across repos). |

### Config (output)
| File | Written by | Consumed by |
|------|------------|-------------|
| `config/tools-automated.json` | `build-tools.ts::buildTools` (after `convertTools`) | Cache for `buildToolsManual` re-runs; committed via PR |
| `config/tools.json` | `combineTools` — final combined list | Frontend `pages/tools/*` and search |
| `config/all-tags.json` | `combineTools` — combined discovered languages + technologies | Frontend tag filters |

## Topics in this sub-chapter

| Topic | Covers |
|-------|--------|
| [`fetching.md`](./fetching.md) | How `.asyncapi-tool` files are discovered on GitHub. Search API, pagination, rate-limit handling, per-tool raw download. |
| [`validation-and-categorisation.md`](./validation-and-categorisation.md) | JSON Schema validation, YAML/JSON parsing, fuzzy category matching via Fuse, category placement. |
| [`combining-automated-and-manual.md`](./combining-automated-and-manual.md) | The combine flow. How `tools-manual.json` and `tools-ignore.json` interact with the automated list. Ignore matching rules. |
| [`tags-and-colors.md`](./tags-and-colors.md) | How each tool's `language` and `technology` filter tags are resolved to display colours, including handling of unknown tags. |
| [`output-files.md`](./output-files.md) | The three output JSON files: shape, consumer, when each is written. |

Also see:
- [`workflows/regenerate-tools.md`](../../workflows/regenerate-tools.md) — the scheduled workflow that runs this pipeline weekly and opens the maintainer-review PR.

## Patterns

Every stage of the pipeline receives a shape from the previous stage and produces a shape for the next. Full data flow:

```
GitHub search API results
        │  (extract-tools-github.ts::getData)
        ▼
Raw items[]  ─────────────►  per-item raw download
        │                            │
        │      (tools-object.ts::convertTools)
        ▼
ToolsListObject (categorised, validated)
        │  written to config/tools-automated.json
        │
        │      +  config/tools-manual.json  (human-authored)
        │      +  config/tools-ignore.json  (filter list)
        │
        │      (combine-tools.ts::combineTools)
        ▼
FinalToolsListObject  ────►  config/tools.json
        +
Discovered languages + technologies  ────►  config/all-tags.json
```

## Common gotchas

- **`buildToolsManual` mode** — `build-tools.ts` has a second entrypoint that skips fetching from GitHub and re-uses cached `tools-automated.json`. It is invoked when only `tools-manual.json` changes and a re-combine is needed. Any change to combine behaviour must produce equivalent output through this path.
- **Fuse index mutation** — `languageFuse` / `technologyFuse` in `combine-tools.ts` are rebuilt every time a new tag is discovered. Rebuilding is intentional to make subsequent searches see the newly-added tag.
- **`incomplete_results` pagination** — GitHub's code search returns `incomplete_results: true` when more pages exist. Pages fetch sequentially with a 1-second `pause` between requests to respect rate limits.
- **Ignore matching** — an ignore entry needs at least `title` or `repoUrl`. Entries with neither are silently skipped. Category scoping is optional.
- **`isAsyncAPIrepo`** — set to `true` when the repo owner is `asyncapi`. Drives the "official" badge in the UI.

## Related topics
- Parent [`content-generation/README.md`](../README.md) — other content generators
- [`workflows/regenerate-tools.md`](../../workflows/regenerate-tools.md) — scheduled workflow
- `deploy` — where the workflow is scheduled and how the PR lands
