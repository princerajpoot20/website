# Docs and Blog — Chapter Overview
> Created: 2026-05-25 | Updated: 2026-05-25

## What this chapter covers

Everything about serving markdown/MDX content: the MDX file layout under `markdown/**`, the custom MDX components that make specialised directives available, the runtime rendering pipeline in `pages/docs` and `pages/blog`, and the docs navigation tree consumed from `config/posts.json`.

Read this chapter for any task touching `markdown/**`, `pages/docs/**`, `pages/blog/**`, `components/docs/**`, `components/MDX/**`, or `mdx-components.tsx`.

For the build-time script that walks the markdown tree and produces `posts.json`, see [`content-generation/posts-and-navigation.md`](../content-generation/posts-and-navigation.md).

## Key files

| File | Role |
|------|------|
| `mdx-components.tsx` | Global MDX component overrides (`h1`, `h2`, `a`, `code`, etc.) |
| `components/MDX/` | Custom MDX components exported for use in docs/blog (`Warning`, `Figure`, `Remember`, `Caption`, callouts, etc.) |
| `markdown/docs/**` | Source MDX for documentation |
| `markdown/blog/**` | Source MDX for blog posts |
| `pages/docs/[[...slug]].tsx` | Dynamic docs route (catch-all) — loads MDX for the slug and renders |
| `pages/blog/[slug].tsx` | Blog post route |
| `components/docs/DocsNav.tsx` | Left-hand docs navigation sidebar |
| `components/docs/Visualizer.tsx` | Schema visualizer embedded in docs pages |
| `components/docs/Card.tsx`, `DocsCards.tsx` | Card layouts used in doc landing pages |
| `config/edit-page-config.json` | Per-doc-path "edit this page on GitHub" URL config |
| `config/posts.json` (generated) | The full parsed catalog — read at render time |

## Topics in this chapter

| Topic | Covers |
|-------|--------|
| [`mdx-pipeline.md`](./mdx-pipeline.md) | How MDX is compiled by Next.js, how `mdx-components.tsx` overrides the base HTML elements, and how custom `components/MDX/` components are registered. |
| [`docs-navigation.md`](./docs-navigation.md) | The docs sidebar: how `DocsNav.tsx` renders `posts.json`'s `docsTree`, section/root-section hierarchy, "Edit this page" wiring. |
| [`spec-versions.md`](./spec-versions.md) | Special handling of `/reference/specification/*` — pre-release detection, "Explorer" tag, release-note linking, and the current-latest-version pointer. |

## Patterns

- MDX files have YAML front-matter (`title`, `weight`, `sectionWeight`, `isRootSection`, `parent`, etc.) that drives navigation placement. See [`../content-generation/posts-and-navigation.md`](../content-generation/posts-and-navigation.md) for the shape.
- `_section.mdx` files under a directory annotate the directory itself (title, weight). Absent → auto-generated section title from the folder name.
- Custom MDX components are opt-in per file via MDX imports and made globally available via `mdx-components.tsx`.
- Every doc page implicitly has an "Edit this page on GitHub" button; the URL comes from `edit-page-config.json` matching the doc's slug.

## Common gotchas

- **`mermaid` and `schyma` are heavy** and imported statically in the MDX barrel — see `PERFORMANCE_PLAN.md` for the dynamic-import mitigation.
- **Blog cover images** live in `public/img/posts/` — many are 1MB+, contribute to LCP.
- **Missing `weight`** in front-matter sends items to the end of the sidebar (undefined sort).
- **`edit-page-config.json`** maps doc paths to GitHub URLs — moving a doc without updating the config produces a 404-hitting edit button, caught by `check-edit-links.yml` in CI.
- **`_section.mdx` file naming.** Must be exactly this — `_section.md` (no x) is NOT picked up by the build.
- **`gray-matter` cache** is explicitly disabled in `build-post-list.ts` (see [issue #1057](https://github.com/asyncapi/website/issues/1057)). Any new front-matter reader in the codebase should do the same.

## Related chapters
- `content-generation` — how docs metadata (`posts.json`) is generated
- `frontend` — general Next.js pages structure and layout wrappers
- `i18n` — how translated docs are served under `[lang]`
