# Docs navigation
> Created: 2026-05-25 | Updated: 2026-05-25

## What this topic covers

The left-hand docs sidebar: how `DocsNav.tsx` renders the `docsTree` from `config/posts.json`, how root sections and subsections are collapsible, how the current page is highlighted, and how the mobile nav flow works.

## Key files

| File | Role |
|------|------|
| `components/docs/DocsNav.tsx` | The nav tree component |
| `components/navigation/DocsNav.tsx` | Wrapper / nav configuration |
| `components/navigation/DocsNavItem.tsx` | Single nav item |
| `components/navigation/DocsNavWrapper.tsx` | Layout wrapper |
| `components/navigation/DocsMobileMenu.tsx` | Mobile nav drawer |
| `config/posts.json` (`docsTree`) | Source of the hierarchy |

## How it works

### 1. Data source
The `docsTree` field of `config/posts.json` (see [`../content-generation/posts-and-navigation.md`](../content-generation/posts-and-navigation.md)) is:

```
{
  welcome:   { item: {title:'Welcome', slug:'/docs'}, children: {} },
  tutorials: { item: {...}, children: { sub1: {item, children:[...]}, sub2: {...} } },
  reference: { item: {...}, children: { specification: {...} } },
  ...
}
```

- Top-level keys are root sections (`welcome`, `tutorials`, `reference`, etc.)
- Each root has `item` (the section metadata) and `children` (a nested map, sorted by weight)
- Leaves are page items with `title`, `slug`, `weight`, etc.

### 2. Render pass
`DocsNav.tsx` (or the nav wrapper) walks `docsTree` in the order determined by the build-time sort — which is:
- Root sections in the order they appear in the tree (build-post-list.ts placement order)
- Their children sorted by `weight` (asc)

Each root section becomes a collapsible group. Each child is either:
- A nested section (with its own collapsible children)
- A leaf page (a link)

### 3. Active state
The current URL is compared to each item's `slug`. Matches receive an "active" style. Ancestors of the active leaf are auto-expanded.

### 4. "Edit this page" wiring
Every doc page renders an "Edit this page on GitHub" link. The URL is looked up from `config/edit-page-config.json` — the same file consumed by `scripts/markdown/check-edit-links.ts`. See [`../content-generation/markdown-quality.md`](../content-generation/markdown-quality.md).

### 5. Mobile nav
`DocsMobileMenu.tsx` mirrors the desktop nav but as a drawer opened by a toggle button. Same data, different layout.

### 6. Reference / specification special case
The `reference` root's `specification` subgroup has its `href` rewritten at build time to point to the latest non-prerelease spec version (see [`../content-generation/posts-and-navigation.md`](../content-generation/posts-and-navigation.md) step 2). So clicking "Specification" in the sidebar always lands on the newest stable version, regardless of how many pre-release versions coexist.

## Configuration

| File | Purpose |
|---|---|
| `config/posts.json` (`docsTree`) | Nav structure |
| `config/edit-page-config.json` | Per-doc-path GitHub edit URL |
| `components/docs/DocsNav.tsx` | Rendering + styling |

## Common gotchas

- **`weight` controls order.** A page without `weight` in front-matter sorts unpredictably (undefined comparison).
- **Nav renders from the tree, not the flat `docs[]` array.** The two are separate outputs of the build; the tree is authoritative for nav.
- **The Welcome page is special-cased.** `addDocButtons` in `build-docs.ts` seeds the first entry from the `/docs` slug specifically.
- **"Edit this page" URL depends on config.** A doc without a matching entry in `edit-page-config.json` gets no button (or a broken one).
- **Rebuild needed after content change.** The nav is baked at build time — new doc pages need a Netlify build to appear. Preview deploys reflect PR changes.
- **Active-state URL comparison must handle trailing slashes.** Next.js may serve `/docs/foo/` and `/docs/foo` — the comparator should normalise.
- **Mobile drawer can trap focus** — accessibility hazard if the escape handler is missing. Test with keyboard nav.

## Related topics
- [`README.md`](./README.md) — parent chapter
- [`mdx-pipeline.md`](./mdx-pipeline.md) — how the pages themselves render
- [`spec-versions.md`](./spec-versions.md) — special handling of specification pages
- [`../content-generation/posts-and-navigation.md`](../content-generation/posts-and-navigation.md) — how `docsTree` is built
