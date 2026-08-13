# Tags and colors
> Created: 2026-05-25 | Updated: 2026-05-25

## What this topic covers

How each tool's `filters.language` and `filters.technology` string tags get resolved into rich objects with display colours for the frontend tag chips. Includes handling of tags not in the canonical list (auto-created with a preset colour) and the `all-tags.json` output. Everything in `scripts/tools/tags-color.ts` plus the `getFinalTool` and tags-write blocks in `scripts/tools/combine-tools.ts`.

## Key files

| File | Role |
|------|------|
| `scripts/tools/tags-color.ts` | Exports two canonical arrays: `languagesColor` and `technologiesColor`. Each item is `{ name, color, borderColor }` — Tailwind class strings for the chip background and border. |
| `scripts/tools/combine-tools.ts` | Owns the runtime `languageList` / `technologyList` (seeded from the canonical arrays), the two Fuse indexes, and the `getFinalTool` enrichment function that mutates them when it encounters a new tag. |

## How it works

### 1. Seed the runtime lists
At module load in `combine-tools.ts`:

```typescript
const languageList = [...languagesColor];
const technologyList = [...technologiesColor];
let languageFuse = new Fuse(languageList, options);
let technologyFuse = new Fuse(technologyList, options);
```

The Fuse config uses fields `['name', 'color', 'borderColor']` with `threshold: 0.39` and `shouldSort: true`.

The seeded arrays contain about a dozen well-known languages (Go/Golang, Java, JavaScript, HTML, C/C++, C#, Python, TypeScript, Kotlin, Ruby, Scala, Rust, and a few more) and technologies (Node.js, Springboot, Micronaut, React, etc.).

### 2. Per-tool enrichment (`getFinalTool`)

For each tool being enriched by the combine flow, `getFinalTool` constructs a `finalObject` seeded with the tool's `title`, `description`, `links`, and a `filters` object whose `categories` and `hasCommercial` are copied through as-is.

Then it resolves `filters.language`:

- If the tool declares `filters.language` (which can be a string or `string[]`), each declared tag is looked up via `languageFuse.search(tag)`.
- If Fuse returns a match, the tool gets a reference to the matched `LanguageColorItem`.
- **If Fuse returns no match**, a new object is constructed with a default color:
  ```typescript
  { name: <declared tag>, color: 'bg-[#57f281]', borderColor: 'border-[#37f069]' }
  ```
  and appended to `languageList`. `languageFuse` is then reassigned to a new Fuse over the updated list so subsequent lookups can find it.

The same flow runs for `filters.technology` with the default color:
```typescript
{ name: <declared tag>, color: 'bg-[#61d0f2]', borderColor: 'border-[#40ccf7]' }
```

The final tool object's `filters.language` and `filters.technology` are the enriched arrays of `LanguageColorItem` objects (not the raw strings).

### 3. Write `all-tags.json`
After every category has been combined, `combine-tools.ts` writes the tag lists to disk:

```typescript
fs.writeFileSync(
  tagsPath,
  JSON.stringify({
    languages: languageList,
    technologies: technologyList,
  }, null, 2)
);
```

Both `languageList` and `technologyList` at this point contain the initial canonical items **plus** every unique tag discovered during enrichment.

## Configuration

| File | Purpose |
|---|---|
| `scripts/tools/tags-color.ts` | Adding a language/technology here means it will be found by fuzzy match and the canonical color will be used. Otherwise the default green/blue is used. |

No env vars affect this stage.

## Common gotchas

- **Fuse threshold 0.39** — subtle but important. A tag like "typescript" will match "TypeScript" (case difference alone is below the threshold), but `"ts"` will not match `"TypeScript"` because the token distance is above 0.39.
- **Fuse index rebuild on discovery** — each new tag triggers `new Fuse(...)`. This is intentional so the next lookup benefits. It also means Fuse allocations grow with the number of unique discovered tags per run.
- **Default colors are the same for every unknown tag** — every newly-discovered language shares one green shade, every new technology shares one blue shade. UI-side, this is why unknown tags all look the same.
- **`sortColorItems` helper is not present at baseline** — tags are appended in first-encounter order, so `languageList` / `technologyList` reflect the sequence in which tools were processed.
- **Manual tools also flow through `getFinalTool`** via `processManualTool`, so manually-declared unknown tags also get the default color.
- **Tool objects share references** — an enriched tool's `filters.language[i]` is a reference to the same `LanguageColorItem` object in `languageList`. Mutating it in one place mutates it everywhere.

## Related topics
- [`combining-automated-and-manual.md`](./combining-automated-and-manual.md) — where `getFinalTool` is called from
- [`output-files.md`](./output-files.md) — the exact shape of `all-tags.json`
