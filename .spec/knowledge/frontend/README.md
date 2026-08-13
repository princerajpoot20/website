# Frontend — Chapter Overview
> Created: 2026-05-25 | Updated: 2026-05-25

## What this chapter covers

Next.js Pages Router structure, React component organisation, layout wrappers, and the Tailwind design token system. Everything the browser renders except MDX content (see [`docs-and-blog`](../docs-and-blog/README.md)) and dashboard-specific components (see [`dashboard/frontend-components.md`](../dashboard/frontend-components.md)).

Read this chapter for any task touching `pages/**` (non-MDX), `components/**` (non-dashboard, non-MDX), `styles/**`, `tailwind.config.js`, or Next.js SSR/CSR boundaries.

## Key files

| File | Role |
|------|------|
| `pages/_app.tsx` | Top-level app wrapper — layout, providers, global scripts, analytics |
| `pages/_document.tsx` | HTML shell — fonts, external stylesheets, external scripts |
| `pages/index.tsx` | Landing page |
| `pages/[lang]/**` | Localised routes (see [`../i18n/README.md`](../i18n/README.md)) |
| `pages/tools/*.tsx` | Tools directory pages (read `config/tools.json`) |
| `pages/community/*.tsx` | Community pages |
| `pages/casestudies/*.tsx` | Case studies pages |
| `pages/finance.tsx` | Finance page — uses `recharts` (heavy) |
| `pages/roadmap.tsx` | Roadmap |
| `pages/newsletter.tsx` | Newsletter signup page — calls the `newsletter_subscription` function |
| `components/layout/` | Layout primitives (containers, headers) |
| `components/navigation/` | Site navigation, docs nav, mobile menu |
| `components/features/`, `components/community/`, `components/newsroom/`, `components/roadmap/` etc. | Feature-scoped component groups |
| `styles/globals.css` | Global CSS + external stylesheet imports (Google Fonts, Fira Code CDN) |
| `tailwind.config.js` | Design tokens (colors, spacing, fonts, breakpoints) |

## Topics in this chapter

| Topic | Covers |
|-------|--------|
| [`pages-router.md`](./pages-router.md) | Pages Router basics for this project: `getStaticProps` / `getStaticPaths` patterns, `_app` and `_document`, dynamic routes, redirects. |
| [`ssr-and-hydration.md`](./ssr-and-hydration.md) | SSR vs client-side patterns, `window`-access guards, `dynamic({ ssr: false })` when to use, hydration-mismatch pitfalls. |
| [`design-tokens.md`](./design-tokens.md) | Tailwind config, colour tokens, dark-mode conventions, font loading. |

## Patterns

- **Pages Router** (not App Router). Data fetching via `getStaticProps` / `getStaticPaths`. No `use client` / `use server` directives.
- **Component organisation by feature area**, not by type. Cards, buttons, layouts live inside the feature folder they serve (`components/community/EventCard.tsx` etc.).
- **Shared primitives** (`Loader.tsx`, `Modal.tsx`, `InputBox.tsx`, `Link.tsx`, `Pagination.tsx`) live at `components/` top level.
- **Tailwind + design tokens.** Colors are defined in `tailwind.config.js` and referenced by name (e.g. `bg-secondary`), not raw hex. Utility classes in components, no per-component CSS files (with a couple of exceptions like `Visualizer.module.css`).
- **Data JSONs are the API.** Pages import from `config/*.json` directly (Next.js resolves as static assets). No runtime fetch for anything content-related.

## Common gotchas

- **`window` access** at module scope throws SSR errors. Wrap in `useEffect` or guard with `typeof window !== 'undefined'`.
- **`next/image` not yet adopted** — most images are raw `<img>` tags. `PERFORMANCE_PLAN.md` Section E covers the migration plan.
- **`_document.tsx` runs server-only** — cannot use hooks or client-side APIs. Add `<script>` tags here (not `_app.tsx`) to get pre-hydration behaviour.
- **`_app.tsx` runs both server and client.** Guarded logic (analytics, browser feature detection) belongs in `useEffect`.
- **Dark mode** uses Tailwind's `dark:` variants. Tokens are migrating to a `theme.extend` map — check `tailwind.config.js` before hardcoding colours.
- **Static exports** may be involved in some CI paths — check `next.config.mjs` before adding runtime-only features.
- **External stylesheets in `styles/globals.css`** are render-blocking. See `PERFORMANCE_PLAN.md` items A–C for the fix (self-host + preload).
- **Duplicate scripts.** `pages/_app.tsx` and `pages/_document.tsx` both load `github-buttons.js` — see `PERFORMANCE_PLAN.md` Section D.

## Related chapters
- `i18n` — localisation
- `docs-and-blog` — MDX rendering
- `netlify-functions` — server-side endpoints called by the frontend
- `dashboard` — dashboard-specific frontend components
