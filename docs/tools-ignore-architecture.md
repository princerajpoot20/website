# Tools Ignore System -- Architecture & Design Document

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Architecture Overview](#architecture-overview)
3. [Data Flow](#data-flow)
4. [File Map](#file-map)
5. [Schema Design](#schema-design)
   - [tools-ignore.json](#tools-ignorejson)
   - [tools-ignored.json (Audit Log)](#tools-ignoredjson-audit-log)
6. [Matching Algorithm](#matching-algorithm)
   - [Ignore Variations](#ignore-variations)
   - [Decision Flowchart](#decision-flowchart)
7. [Code Walkthrough](#code-walkthrough)
   - [Type Definitions](#type-definitions)
   - [shouldIgnoreTool()](#shouldignoretool)
   - [combineTools()](#combinetools)
   - [build-tools.ts Entry Point](#build-toolsts-entry-point)
8. [Usage Guide](#usage-guide)
   - [Variation 1: Ignore by Title (Global)](#variation-1-ignore-by-title-global)
   - [Variation 2: Ignore by Title + repoUrl (Specific Fork)](#variation-2-ignore-by-title--repourl-specific-fork)
   - [Variation 3: Ignore by Title with Category Scope](#variation-3-ignore-by-title-with-category-scope)
   - [Variation 4: Ignore by Title + repoUrl + Category Scope](#variation-4-ignore-by-title--repourl--category-scope)
9. [Why This Design?](#why-this-design)
10. [Test Coverage](#test-coverage)
11. [Backward Compatibility](#backward-compatibility)

---

## Problem Statement

The AsyncAPI website displays a curated list of community tools. These tools are gathered from two sources:

1. **Automated** -- A GitHub Actions workflow runs on a schedule, fetches tool metadata via the GitHub API, and writes `tools-automated.json`.
2. **Manual** -- Maintainers hand-curate entries in `tools-manual.json`.

A combine script merges both sources into a single `tools.json` that the website reads.

**The problem:** Everything fetched from the GitHub API is included without any filtering. If a fork, a deprecated project, or a spam entry appears in the automated data, there is no mechanism to exclude it from the final output. The tools-ignore system solves this by introducing a declarative ignore list that filters out unwanted entries during the combine step.

---

## Architecture Overview

```
                     GitHub API
                         |
                         v
             +-------------------------+
             | extract-tools-github.ts |  (fetch .asyncapi-tool files)
             +-------------------------+
                         |
                         v
              +--------------------+
              |  tools-object.ts   |  (convert to standard format)
              +--------------------+
                         |
                         v
            +------------------------+
            | tools-automated.json   |  (raw automated tools)
            +------------------------+
                         |
    +--------------------+--------------------+
    |                                         |
    v                                         v
+---------------------+            +---------------------+
| tools-manual.json   |            | tools-ignore.json   |  <-- NEW
+---------------------+            +---------------------+
    |                                         |
    +---------+         +---------------------+
              |         |
              v         v
      +-------------------------+
      |   combine-tools.ts      |  (merge + filter + enrich)
      +-------------------------+
              |              |
              v              v
    +-------------+   +------------------+
    | tools.json  |   | tools-ignored.json|  <-- NEW (audit log)
    +-------------+   +------------------+
              |
              v
        Website UI
```

The new `tools-ignore.json` file sits alongside the existing config files and is read during the combine step. Any tool matching an ignore rule is filtered out **before** enrichment and merging. A companion `tools-ignored.json` audit log is written to record exactly what was filtered and why.

---

## Data Flow

Here is the step-by-step flow when `npm run generate:tools` executes:

```
1. build-tools.ts is invoked
       |
2. getData() fetches .asyncapi-tool files from GitHub repos
       |
3. convertTools() normalizes the raw data into ToolsListObject format
       |
4. Result is written to config/tools-automated.json
       |
5. config/tools-manual.json is read from disk
       |
6. config/tools-ignore.json is read from disk (if it exists)
       |
7. combineTools() is called with all three inputs
       |
       +---> For each category:
       |       |
       |       +---> Filter automated tools against the ignore list
       |       |         (shouldIgnoreTool() called per tool)
       |       |         Ignored tools are recorded in the audit array
       |       |
       |       +---> Enrich surviving automated tools (getFinalTool)
       |       |         - Fuzzy-match language/technology tags
       |       |         - Assign display colors
       |       |
       |       +---> Filter manual tools against the ignore list
       |       |         (shouldIgnoreTool() called per tool)
       |       |         Ignored tools are recorded in the audit array
       |       |
       |       +---> Validate & enrich surviving manual tools
       |       |         - JSON schema validation (Ajv)
       |       |         - getFinalTool enrichment
       |       |
       |       +---> Merge automated + manual results
       |       |
       |       +---> Sort alphabetically by title
       |
8. Write config/tools.json (combined output)
       |
9. Write config/all-tags.json (language + technology tags)
       |
10. Write config/tools-ignored.json (audit log of what was filtered)
```

---

## File Map

| File | Role | Committed to Git? |
|------|------|:-:|
| `config/tools-automated.json` | Raw automated tools from GitHub API | Yes |
| `config/tools-manual.json` | Hand-curated manual tool entries | Yes |
| `config/tools-ignore.json` | Declarative ignore rules | Yes |
| `config/tools.json` | Final combined output for the website | Yes |
| `config/all-tags.json` | Aggregated language/technology tags | Yes |
| `config/tools-ignored.json` | Auto-generated audit log | No (.gitignore) |
| `scripts/build-tools.ts` | Orchestrator / entry point | Yes |
| `scripts/tools/combine-tools.ts` | Core merge + filter + enrich logic | Yes |
| `types/scripts/tools.ts` | TypeScript type definitions | Yes |
| `tests/tools/combine-tools.test.ts` | Unit tests | Yes |
| `tests/fixtures/combineToolsData.ts` | Test fixture data | Yes |

---

## Schema Design

### tools-ignore.json

Located at `config/tools-ignore.json`. This is the file maintainers edit to control which tools are excluded.

```json
{
  "description": "Human-readable description of this file's purpose.",
  "tools": [
    {
      "title": "Tool Name",
      "repoUrl": "https://github.com/owner/repo",
      "reason": "Why this tool is being ignored",
      "categories": ["Editors", "CLIs"]
    }
  ]
}
```

**Field reference:**

| Field | Type | Required | Description |
|-------|------|:--------:|-------------|
| `title` | `string` | Yes | Exact title of the tool to match. |
| `repoUrl` | `string` | No | When provided, both `title` AND `repoUrl` must match. This is how you target a specific fork without affecting the original. |
| `reason` | `string` | Yes | Documents why this tool is being excluded. Appears in the audit log. |
| `categories` | `string[]` | No | When provided, the tool is only removed from these specific categories. When omitted, the tool is removed from **all** categories it appears in. Values must match category names exactly (e.g., `"Editors"`, `"Code-first tools"`, `"AsyncAPI Generator Templates"`). |

### tools-ignored.json (Audit Log)

Auto-generated at `config/tools-ignored.json` on every combine run. This file is in `.gitignore` and serves as a local verification artifact.

```json
{
  "description": "Auto-generated audit log of tools ignored during the last combine run.",
  "generatedAt": "2026-02-22T10:27:48.978Z",
  "totalIgnored": 7,
  "ignoredTools": [
    {
      "title": "SIO-AsyncAPI",
      "repoUrl": "https://github.com/daler-rahimov/sio-asyncapi",
      "reason": "Deprecated tool",
      "category": "APIs",
      "source": "automated",
      "ignoredAt": "2026-02-22T10:27:48.922Z"
    }
  ]
}
```

**Field reference for each entry in `ignoredTools`:**

| Field | Description |
|-------|-------------|
| `title` | Title of the tool that was ignored. |
| `repoUrl` | The tool's repository URL (for identification). |
| `reason` | The reason string from the matching ignore rule. |
| `category` | Which category this specific removal happened in. |
| `source` | Whether the tool came from `"automated"` or `"manual"` data. |
| `ignoredAt` | ISO 8601 timestamp of when the ignore was applied. |

A single ignore rule can produce multiple audit records if the tool appears in several categories.

---

## Matching Algorithm

### Ignore Variations

The system supports four distinct ignore strategies, each providing a different level of precision:

| # | Strategy | Fields Used | What Gets Removed |
|---|----------|-------------|-------------------|
| 1 | Title only | `title` | All tools with that title, in all categories |
| 2 | Title + repoUrl | `title`, `repoUrl` | Only the exact title+repo combination, in all categories |
| 3 | Title + categories | `title`, `categories` | All tools with that title, but only in the listed categories |
| 4 | Title + repoUrl + categories | `title`, `repoUrl`, `categories` | Only the exact title+repo combination, only in the listed categories |

### Decision Flowchart

For each tool in each category, the `shouldIgnoreTool()` function evaluates every entry in the ignore list:

```
For each ignore entry:
  |
  +---> Does the entry have `categories`?
  |       |
  |       Yes --> Is the current category in that list?
  |       |        |
  |       |        No --> SKIP this entry, move to next
  |       |        |
  |       |        Yes --> continue
  |       |
  |       No --> continue (applies to all categories)
  |
  +---> Does `tool.title === entry.title`?
  |       |
  |       No --> SKIP this entry, move to next
  |       |
  |       Yes --> continue
  |
  +---> Does the entry have `repoUrl`?
          |
          Yes --> Does `tool.links.repoUrl === entry.repoUrl`?
          |        |
          |        Yes --> MATCH FOUND -> ignore this tool
          |        |
          |        No --> SKIP this entry, move to next
          |
          No --> MATCH FOUND -> ignore this tool

If no entry matches after checking all: KEEP the tool
```

---

## Code Walkthrough

### Type Definitions

**File:** `types/scripts/tools.ts`

Three types were added to support the ignore system:

```typescript
// A single entry in tools-ignore.json
export interface ToolIgnoreEntry {
  title: string;
  repoUrl?: string;
  reason: string;
  categories?: string[];
}

// The top-level structure of tools-ignore.json
export interface ToolsIgnoreFile {
  description: string;
  tools: ToolIgnoreEntry[];
}

// A record in the tools-ignored.json audit log
export interface IgnoredToolRecord {
  title: string;
  repoUrl?: string;
  reason: string;
  category: string;
  source: 'automated' | 'manual';
  ignoredAt: string;
}
```

### shouldIgnoreTool()

**File:** `scripts/tools/combine-tools.ts`

This is the core matching function. It takes a tool, the current category name, and the full ignore list, then returns the matching ignore entry (or `null` if no match).

```typescript
function shouldIgnoreTool(
  tool: AsyncAPITool,
  category: string,
  ignoreList: ToolIgnoreEntry[]
): ToolIgnoreEntry | null {
  for (const entry of ignoreList) {
    // Skip if entry is scoped to specific categories and this isn't one of them
    if (entry.categories?.length && !entry.categories.includes(category)) {
      continue;
    }

    const titleMatches = tool.title === entry.title;

    if (entry.repoUrl) {
      // When repoUrl is specified, both title AND repoUrl must match
      if (titleMatches && tool.links?.repoUrl === entry.repoUrl) {
        return entry;
      }
    } else if (titleMatches) {
      // When only title is specified, title match is sufficient
      return entry;
    }
  }

  return null;
}
```

Key design decisions:
- Title matching is **exact** (case-sensitive). This prevents accidental matches on similar-but-different tools.
- When `repoUrl` is present, it acts as an AND condition with `title`, not a standalone matcher. This ensures you cannot accidentally ignore a tool just because it shares a repo URL.
- The function returns the matched `ToolIgnoreEntry` (not just a boolean) so the caller can extract the `reason` for the audit log.

### combineTools()

**File:** `scripts/tools/combine-tools.ts`

The main combine function was updated to accept two new optional parameters:

```typescript
const combineTools = async (
  automatedTools: ToolsListObject,
  manualTools: ToolsListObject,
  toolsPath: string,
  tagsPath: string,
  ignorePath?: string,         // NEW
  ignoredOutputPath?: string   // NEW
): Promise<void> => { ... }
```

The ignore logic is inserted **before** the enrichment step for both automated and manual tools:

```
Original flow:      automated tools --> enrich --> merge with manual --> sort --> write
New flow:           automated tools --> FILTER --> enrich --> merge with FILTERED manual --> sort --> write
                                          |                                    |
                                          +--- audit record ---+--- audit record ----> write audit log
```

Filtering happens via `Array.filter()` with `shouldIgnoreTool()`. Each filtered-out tool gets an `IgnoredToolRecord` pushed to the `ignoredTools` array, which is written to the audit file at the end.

### build-tools.ts Entry Point

**File:** `scripts/build-tools.ts`

Both `buildTools()` and `buildToolsManual()` were updated to accept and pass through `ignorePath` and `ignoredOutputPath`. The main CLI entry block resolves these paths:

```typescript
const ignorePath = resolve(currentDirPath, '../config', 'tools-ignore.json');
const ignoredOutputPath = resolve(currentDirPath, '../config', 'tools-ignored.json');

buildTools(
  automatedToolsPath, manualToolsPath, toolsPath, tagsPath,
  ignorePath, ignoredOutputPath
);
```

These parameters are optional. When not provided (or when the ignore file doesn't exist on disk), the combine step behaves identically to before -- no tools are filtered.

---

## Usage Guide

### Variation 1: Ignore by Title (Global)

Remove a tool from **every** category it appears in. Use when the tool itself is the problem (deprecated, spam, etc.).

```json
{
  "title": "SIO-AsyncAPI",
  "reason": "Project is deprecated and no longer maintained"
}
```

**Effect:** Every entry with `title === "SIO-AsyncAPI"` is removed from all categories (APIs, Code-first tools, etc.).

### Variation 2: Ignore by Title + repoUrl (Specific Fork)

Remove only a specific fork/clone while keeping the original. Use when multiple tools share the same title but have different repositories.

```json
{
  "title": "AsyncAPI Studio",
  "repoUrl": "https://github.com/Shurtu-gal/action-test-bed",
  "reason": "Fork repository, not the official AsyncAPI Studio"
}
```

**Effect:** Only the entry with title `"AsyncAPI Studio"` AND repo `"https://github.com/Shurtu-gal/action-test-bed"` is removed. The official `asyncapi/studio` and any other forks with different repos are untouched.

### Variation 3: Ignore by Title with Category Scope

Remove a tool from specific categories only. Use when a tool is correctly listed in some categories but incorrectly appears in others.

```json
{
  "title": "Zod Sockets",
  "reason": "Not primarily a framework, better categorized as code-first and DSL",
  "categories": ["Frameworks"]
}
```

**Effect:** `"Zod Sockets"` is removed from the `"Frameworks"` category only. It remains in `"Code-first tools"` and `"DSL"`.

### Variation 4: Ignore by Title + repoUrl + Category Scope

The most precise option. Targets a specific repo in specific categories.

```json
{
  "title": "HTML Template",
  "repoUrl": "https://github.com/dipaksodani/async-gen",
  "reason": "Fork, only remove from templates listing",
  "categories": ["AsyncAPI Generator Templates"]
}
```

**Effect:** Only the specific fork is removed, and only from the `"AsyncAPI Generator Templates"` category.

---

## Why This Design?

### Why title as the primary key (not repoUrl alone)?

A tool's identity from a user's perspective is its **title**. Using title as the required field makes the ignore file readable and reviewable. The `repoUrl` serves as an optional disambiguator for the common case where forks share a title.

### Why exact matching instead of fuzzy/regex?

Exact matching is predictable and auditable. When a maintainer adds an ignore rule, they can be certain it will only affect the exact tool they specified. Fuzzy matching could produce surprising results (e.g., ignoring "AsyncAPI" could match "AsyncAPI CLI", "AsyncAPI Studio", etc.).

### Why category scoping?

The same tool frequently appears in multiple categories (e.g., a tool categorized as both `code-first` and `framework`). Category scoping lets maintainers make precise corrections to categorization without removing the tool entirely.

### Why an audit log?

The audit log (`tools-ignored.json`) provides:
- **Verification** -- After running the build, a maintainer can inspect exactly what was filtered.
- **Debugging** -- If a tool unexpectedly disappears from the website, the audit log shows whether it was filtered by an ignore rule.
- **Transparency** -- The audit log records the reason, source, category, and timestamp for every ignored entry.

### Why is the audit log git-ignored?

It is regenerated on every combine run and contains timestamps that would create noisy diffs. It is meant as a local verification tool, not a permanent record.

---

## Test Coverage

The ignore system is covered by **13 dedicated tests** across two test suites in `tests/tools/combine-tools.test.ts`:

### `shouldIgnoreTool` unit tests (5 tests)

| Test | What It Verifies |
|------|-----------------|
| Match by title only | A title-only rule matches tools with that title |
| No match when title differs | Non-matching titles are not affected |
| Match specific repo | A title+repoUrl rule only matches the exact combination |
| Respect category scope | A category-scoped rule only applies within those categories |
| Empty ignore list | Returns null when the ignore list is empty |

### `combineTools` with ignore file integration tests (8 tests)

| Test | What It Verifies |
|------|-----------------|
| Ignore automated tools by title | Filtered tools are absent from output |
| Ignore only the fork by repoUrl | Original tool survives, fork is removed |
| Category-scoped ignore | Tool removed from target category, present in others |
| Ignore manual tools | Manual tools are also subject to ignore rules |
| Audit log content | Correct title, reason, source, category, and timestamp in log |
| Empty audit log | Audit file is written even when nothing is ignored |
| No ignore path provided | Falls back to original behavior (no filtering) |
| Non-existent ignore file | Gracefully handled, no filtering applied |

All tests can be run with:

```bash
npx jest tests/tools/combine-tools.test.ts
```

---

## Backward Compatibility

The ignore system is fully backward compatible:

- All new parameters (`ignorePath`, `ignoredOutputPath`) are **optional** in every function signature.
- When `tools-ignore.json` does not exist or has an empty `tools` array, the combine step produces **identical output** to the original implementation.
- Existing tests continue to pass unchanged -- they call `combineTools()` without the new parameters and work exactly as before.
- The GitHub Actions workflow (`regenerate-tools.yml`) does not need any changes. The `npm run generate:tools` command calls `build-tools.ts`, which automatically resolves and uses the ignore file if present.
