# Posts and navigation
> Created: 2026-05-25 | Updated: 2026-05-25

## What this topic covers

How `scripts/build-post-list.ts` walks the MDX tree under `pages/docs`, `pages/blog`, and `pages/about`, extracts front-matter, and builds the docs navigation hierarchy plus next/previous page links. This is the single largest content-generation script and produces `config/posts.json`, which nearly every frontend page reads.

## Key files

| File | Role |
|------|------|
| `scripts/build-post-list.ts` | Entry point. Owns `buildPostList`, `walkDirectories`, `slugifyToC`, `addItem`. |
| `scripts/build-docs.ts` | Helpers: `buildNavTree`, `addDocButtons`, `convertDocPosts` — invoked by `build-post-list.ts` once walking is done. |
| `pages/docs/**/*.mdx`, `pages/blog/**/*.mdx`, `pages/about/**/*.mdx` | Source content |
| `pages/**/_section.mdx` | Section-metadata files that annotate a directory (title, weight, root vs sub-section) |
| `config/posts.json` | Output — the full parsed catalog, plus the docs tree |

## How it works

### 1. Walk each source directory
`buildPostList` is called with three directory tuples: `pages/blog`, `pages/docs`, `pages/about`. For each, `walkDirectories` recurses:

- **On a directory** — check for `_section.mdx`; if present, its front-matter defines section title, `sectionWeight`, `isRootSection` etc. Otherwise a bare `{title: capitalize(basename)}` section is synthesised. The section is added to the result, then the directory is recursed with the section as parent.
- **On a `.mdx` file** (not `_section.mdx`) — read, parse front-matter via `gray-matter`, build a `Details` object with:
  - `toc`: table of contents via `markdown-toc` with a custom slug function (`slugifyToC`) that extracts `{#id}` or `<a name="id">` anchors
  - `readingTime`: `readingTime(content).minutes` rounded up
  - `excerpt`: first 200 chars of `markdownToTxt(content)` (unless front-matter provides one)
  - `sectionSlug`, `sectionWeight`, `sectionTitle`, `sectionId`, `rootSectionId`: inherited from the walking parent
  - `id`: the normalised file path
  - `isIndex`: true if the file is `index.mdx`
  - `slug`: `sectionSlug` if `isIndex`, otherwise the URL path without `.mdx`
- **Special: spec version files** at `/reference/specification/`, if `title` is missing, `getVersionDetails` synthesises a title from the filename. `handleSpecificationVersion` adds " (Pre-release)" for `next-spec` / `next-major-spec` files, and " - Explorer" for `explorer` files.
- **Special: release notes files** — files named `release-notes-*.mdx` under `/blog` are tracked separately (in a module-level `releaseNotes` array) so that spec-version pages can be linked to their release notes via `releaseNoteLink`.

Each parsed item is added to the result via `addItem`, which routes to `docs`, `blog`, or `about` based on the slug prefix.

### 2. Build the navigation tree
Once walking finishes, `build-docs.ts::buildNavTree` runs over `finalResult.docs`. It seeds the tree with a `welcome` root section, then places every item:

- Items with `isRootSection: true` become top-level tree keys
- Items with a `parent` are placed as subsections under that parent
- Non-section items land under their `rootSectionId` — either directly or via a `sectionId` bucket

After placement, each root's children are sorted by `weight`, and inside each root section subsections' children are sorted the same way. A parent that isn't a direct sibling of a placed subsection throws `"Parent section {name} not found"`.

**Reference / specification exception:** the root `reference` node with a `specification` child has its href rewritten to the first non-prerelease specification's `slug`. This keeps `/docs/reference/specification` pointed at the latest stable version.

### 3. Enrich with next/prev nav
`build-docs.ts::addDocButtons` flattens the tree in traversal order into a `structuredPosts` array. It then assigns `nextPage` and `prevPage` to each doc entry:

- If the adjacent entry is a section marker (not a real page), it skips to the entry after that and formats the label as `"{sectionTitle} - {pageTitle}"`
- The first post is replaced with the entry whose slug is `/docs` (the welcome page) so root nav starts from Welcome

### 4. Write output
`buildPostList` writes the enriched `finalResult` to `config/posts.json`:
```json
{
  "docs": [...],      // all docs entries, enriched with nextPage/prevPage
  "blog": [...],
  "about": [...],
  "docsTree": {...}   // hierarchical navigation
}
```

## Configuration

| Setting | Where |
|---|---|
| Source directories | Hardcoded in `scripts/index.ts::start` |
| `basePath` | `pages` — used to derive slugs |
| Heading ID regex | `HEADING_ID_REGEX` in `build-post-list.ts` — matches `{#id}` and `<a name="id">` |
| `specWeight` | Module-level counter starting at 100, decremented per spec version to sort them descending |

## Common gotchas

- **`gray-matter` cache** — a bug required disabling gray-matter's cache (`frontMatter(content, {})` with an empty options object). See [issue #1057](https://github.com/asyncapi/website/issues/1057) referenced inline.
- **`_section.mdx` is mandatory** for any directory that wants a title/weight in the nav. Without it, the directory becomes a synthesised section with a capitalized basename title.
- **`weight` controls order everywhere.** Missing weight = sorts last (undefined comparison). Every non-trivial doc should have one.
- **Blog and about are flat.** Only docs get a tree. `blog[]` and `about[]` are just arrays.
- **`releaseNotes` is module-level state.** A second call to `buildPostList` in the same process reuses the accumulated release-notes list — safe for cold starts, hazardous for hot reloads.
- **`specWeight` also module-level.** Same warning — repeat invocations decrement further from where the last left off, producing weird weights.
- **`sectionSlug` fallback.** For non-index files, if the walking directory tuple has no explicit slug, the file's slug (minus `.mdx`) is used. Passing an explicit slug tuple keeps output stable.
- **Every spec page under `/reference/specification/` that lacks a title** gets one auto-generated. Adding a title in the front-matter overrides — do so if the auto-title is wrong.

## Related topics
- [`rss-feed.md`](./rss-feed.md) — consumes `posts.json` to produce RSS
- [`markdown-quality.md`](./markdown-quality.md) — validates the front-matter that this script parses
- `../docs-and-blog/README.md` — how `posts.json` and `docsTree` are rendered client-side
