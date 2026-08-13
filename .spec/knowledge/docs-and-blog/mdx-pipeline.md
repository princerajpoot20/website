# MDX pipeline
> Created: 2026-05-25 | Updated: 2026-05-25

## What this topic covers

How MDX files are compiled by Next.js and turned into React trees, how `mdx-components.tsx` provides global overrides for base HTML tags, and how custom docs components (`Warning`, `Figure`, `Remember`, etc.) are exported for use inside MDX.

## Key files

| File | Role |
|------|------|
| `mdx-components.tsx` | The `useMDXComponents` (or equivalent global mapping) export — overrides `h1`, `h2`, `a`, `code`, `pre`, etc. |
| `components/MDX/MDX.tsx` | Barrel that re-exports custom MDX components |
| `components/MDX/*.tsx` | Individual components: `Warning`, `Figure`, `Remember`, `Caption`, callouts |
| `next.config.mjs` | MDX loader configuration (rehype/remark plugins, extensions) |

## How it works

### 1. MDX compilation
Next.js's MDX loader (via `@next/mdx` or `mdx-components.tsx` config) compiles `.mdx` files into React components at build time. The loader chain:

- **remark plugins** — transform Markdown AST (e.g. GFM tables, autolink headings)
- **rehype plugins** — transform HTML AST (e.g. syntax highlighting via `rehype-prism-plus`)
- **Frontmatter extraction** — YAML at the top of the file becomes accessible as an export

### 2. Global component overrides (`mdx-components.tsx`)
Every base HTML element rendered inside MDX can be mapped to a custom React component. Examples:
- `h1`, `h2`, `h3` — mapped to versions with anchor links + specific styling
- `a` — mapped to `next/link` with security defaults for external URLs
- `code`, `pre` — mapped to syntax-highlighted variants
- `img` — could map to `next/image` (currently raw `<img>` — see `PERFORMANCE_PLAN.md`)

The mapping is applied globally — every `.mdx` file gets these overrides without needing to import them.

### 3. Custom MDX components (`components/MDX/`)
Components that aren't standard HTML elements but appear inside MDX content:

- **`Warning`** — coloured admonition box, typically for cautions and gotchas
- **`Figure`** — image + caption + optional attribution
- **`Remember`** — callout for reminders / tips
- **`Caption`** — used inside `Figure` and elsewhere
- **`MacWindow`** — screenshot styling with a macOS window chrome
- **`DemoAnimation`** — the animated hero on the landing page
- (and others under `components/MDX/`)

These are re-exported from `components/MDX/MDX.tsx` and can be imported inside `.mdx` files:

```mdx
import { Warning, Figure } from '../../components/MDX/MDX';

<Warning>Don't do X.</Warning>
<Figure src="..." caption="..." />
```

Or, if registered in `mdx-components.tsx` as global components, they can be used without import.

### 4. Syntax highlighting
Code blocks with a language hint get syntax-highlighted. The choice of tool (Prism vs Shiki) is set in `next.config.mjs`. Client-side, `react-syntax-highlighter` renders interactive code blocks (e.g. in the editor components under `components/editor/`).

## Configuration

| File | Purpose |
|---|---|
| `next.config.mjs` | MDX loader options, rehype/remark plugin chain |
| `mdx-components.tsx` | Global HTML-tag → component overrides |
| `components/MDX/MDX.tsx` | Custom components exported for MDX use |

## Common gotchas

- **`mermaid` heavy import.** `mermaid` is imported by an MDX component (for architecture diagrams). Because MDX components are imported statically in the barrel, `mermaid` ends up in the initial JS bundle for pages that don't use it. See `PERFORMANCE_PLAN.md` Section H for the `dynamic({ ssr: false })` mitigation.
- **`schyma` heavy import.** Same issue for the schema visualizer.
- **`react-syntax-highlighter` is heavy.** Not currently code-split — see `PERFORMANCE_PLAN.md` Section K.
- **Component name collision.** If a custom MDX component has the same name as an HTML tag override (e.g. both a custom `Link` and the `a` override), the more specific import wins in that file.
- **SSR-only components** wrapped in `dynamic({ ssr: false })` cannot appear inside MDX rendered during SSR without causing hydration mismatches. Test in dev before enabling.
- **Frontmatter is NOT stripped from the MDX render output automatically** — the build-time script parses it separately. Any leftover front-matter-style content in the MDX body renders as literal text.

## Related topics
- [`README.md`](./README.md) — parent chapter
- [`docs-navigation.md`](./docs-navigation.md) — the sidebar that references these MDX files
- [`../content-generation/posts-and-navigation.md`](../content-generation/posts-and-navigation.md) — the build-time walker
