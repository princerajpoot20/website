# Specification version pages
> Created: 2026-05-25 | Updated: 2026-05-25

## What this topic covers

The special handling that applies to docs under `/reference/specification/`: auto-generated titles from filenames, pre-release detection, "Explorer" tag, release-note linking, and the "current stable" pointer that rewrites the sidebar link.

## Key files

| File | Role |
|------|------|
| `scripts/build-post-list.ts` | `getVersionDetails`, `handleSpecificationVersion` — apply the special rules during doc walking |
| `scripts/build-docs.ts::buildNavTree` | Sets `allChildren.specification.item.href` to the latest non-prerelease spec version |
| `markdown/docs/reference/specification/*.mdx` | The source files (`v2.6.0.mdx`, `next-spec.mdx`, `v3.0.0-explorer.mdx`, etc.) |
| `pages/docs/[[...slug]].tsx` | Renders individual spec pages |

## How it works

### 1. Auto-generated title
Files under `/reference/specification/` whose front-matter omits `title` get one synthesised from the filename:

```typescript
function getVersionDetails(slug, weight) {
  const fileBaseName = basename(slug);
  const versionName = fileBaseName.split('-')[0];  // e.g. "v2.6.0" from "v2.6.0-explorer"
  return {
    title: versionName.startsWith('v')
      ? capitalize(versionName.slice(1))   // "v2.6.0" → "2.6.0"
      : capitalize(versionName),
    weight,
  };
}
```

The weight comes from a module-level counter `specWeight = 100` that decrements per call. Newer files walked later get lower weights → they sort earlier in the nav (weight ascending). This means adding a new spec version bumps it to the top automatically, without editing existing weights.

### 2. Pre-release marker
```typescript
function handleSpecificationVersion(details, fileBaseName) {
  if (fileBaseName.includes('next-spec') || fileBaseName.includes('next-major-spec')) {
    details.isPrerelease = true;
    details.title += ' (Pre-release)';
  }
  if (fileBaseName.includes('explorer')) {
    details.title += ' - Explorer';
  }
  return details;
}
```

Two markers:
- **Pre-release** — files named `next-spec.mdx` or `next-major-spec.mdx` get `isPrerelease: true` and " (Pre-release)" suffix
- **Explorer** — files named `*explorer*.mdx` get " - Explorer" suffix

Both markers stack (a file named `next-spec-explorer.mdx` would have both suffixes).

### 3. Release-note linking
`build-post-list.ts` maintains a module-level `releaseNotes: string[]` array. During the walk, any blog file whose name starts with `release-notes-` has its version segment extracted and pushed:

```typescript
if (file.startsWith('release-notes') && dir[1] === '/blog') {
  const { name } = parse(file);
  const version = name.split('-').pop();  // e.g. "release-notes-v2.6.0" → "v2.6.0"
  releaseNotes.push(version);
}
```

Then, during spec-version processing, if the spec's derived title (e.g. `"2.6.0"`) is found in `releaseNotes`, the spec item gains:

```typescript
details.releaseNoteLink = `/blog/release-notes-${details.title}`;
```

This is what enables the "Release notes" link on each spec page.

### 4. Nav rewrite to latest stable
`build-docs.ts::buildNavTree` post-processes the `reference/specification` subgroup:

```typescript
if (rootKey === 'reference' && key === 'specification') {
  allChildren[key].item.href = childrenOfAllChildren.find(
    c => c.isPrerelease === undefined
  )!.slug;
}
```

The subgroup's `href` (what the "Specification" link in the nav points to) is set to the first non-prerelease child's slug. Combined with the descending weight order (newest first), this means the sidebar always points at the latest stable spec.

### 5. Ignored by edit-link checker
`scripts/markdown/check-edit-links.ts` has an `ignoreFiles` array:

```typescript
const ignoreFiles = [
  'reference/specification/v2.x.md',
  'reference/specification/v3.0.0-explorer.md',
  'reference/specification/v3.0.0.md',
];
```

These files have edit URLs that don't match the standard `edit-page-config.json` templates. Rather than special-case them in `determineEditLink`, they're skipped from the 404 check entirely.

## Configuration

| Constant / var | Where | Purpose |
|---|---|---|
| `specWeight` | `build-post-list.ts` module-level | Auto-weight counter for spec versions |
| `releaseNotes` | `build-post-list.ts` module-level | List of blog release-note versions available for linking |
| `ignoreFiles` | `check-edit-links.ts` | Spec files excluded from the 404 check |
| Filename patterns | `handleSpecificationVersion` | `next-spec`, `next-major-spec`, `explorer` triggers |

## Common gotchas

- **`specWeight` and `releaseNotes` are module-level state.** Repeat invocations of `buildPostList` in the same process accumulate — `specWeight` decrements further, `releaseNotes` grows. Cold-start build only; hot reload would misbehave.
- **`find(c => c.isPrerelease === undefined)`** returns the first item whose `isPrerelease` is exactly `undefined`. `isPrerelease: false` would NOT match. This is intentional — pre-release is set only for the marker files; stable versions leave the field absent.
- **Adding a new spec version requires no config.** Drop a `vX.Y.Z.mdx` file, the auto-title + auto-weight + latest-pointer chain does the rest. The blog release-note file (if present) auto-links.
- **Filename markers are case-sensitive** — `Next-Spec.mdx` won't match `next-spec`.
- **Multiple stable versions coexist.** The nav pointer picks the first (highest-weighted) stable. Others remain accessible via direct slugs.
- **Explorer suffix is cosmetic** — the file is still treated as its base version for release-note linking (via title match).
- **`v2.x.md` in `ignoreFiles`** uses `.md` (not `.mdx`) extension. Watch this if the file is ever renamed to `.mdx` — the ignore rule silently stops applying.

## Related topics
- [`README.md`](./README.md) — parent chapter
- [`docs-navigation.md`](./docs-navigation.md) — how the rewritten "Specification" link renders
- [`../content-generation/posts-and-navigation.md`](../content-generation/posts-and-navigation.md) — the walker that applies these rules
- [`../content-generation/markdown-quality.md`](../content-generation/markdown-quality.md) — the edit-link checker with the ignore list
