# Pages Router
> Created: 2026-05-25 | Updated: 2026-05-25

## What this topic covers

Next.js Pages Router conventions used in this project: file-based routing under `pages/`, data fetching via `getStaticProps` / `getStaticPaths`, `_app.tsx` and `_document.tsx` responsibilities, dynamic and catch-all routes, and how the `[lang]` internationalised routes work.

## Key files

| File | Role |
|------|------|
| `pages/_app.tsx` | Wraps every page. Global layout, providers, analytics, initial mount scripts. |
| `pages/_document.tsx` | HTML shell. Fonts, external CSS/JS, `<head>` meta. Runs server-side only. |
| `pages/index.tsx` | Landing page (`/`) |
| `pages/[lang]/**` | Localised route mirror (`/es/*`, `/de/*` etc. — see `../i18n/README.md`) |
| `pages/docs/[[...slug]].tsx` | Catch-all docs route |
| `pages/blog/[slug].tsx` | Dynamic blog route |
| `next.config.mjs` | Next.js config — redirects, rewrites, MDX loader, image domains |
| `netlify.toml` | Additional runtime redirects / headers set at Netlify edge (some overlap with `next.config.mjs`) |

## How it works

### 1. File-based routing
Files under `pages/*` map to URLs:
- `pages/index.tsx` → `/`
- `pages/newsletter.tsx` → `/newsletter`
- `pages/tools/index.tsx` → `/tools`
- `pages/blog/[slug].tsx` → `/blog/:slug`
- `pages/docs/[[...slug]].tsx` → `/docs`, `/docs/x`, `/docs/x/y/z` (optional catch-all)

Files whose names start with `_` (`_app.tsx`, `_document.tsx`) are not routed — they wrap or shape the rendering pipeline.

### 2. `_app.tsx`
Wraps every page component. Common uses in this project:
- Layout wrapper (header, footer, container)
- Global CSS imports (`import 'styles/globals.css'`)
- Analytics scripts
- Feature-flag / theme providers
- Client-only setup in `useEffect`

Any code here runs on both server (SSR) and client. Guard browser-only APIs.

### 3. `_document.tsx`
Runs server-side only. Modifies the HTML shell:
- `<head>` — meta tags, fonts, preload/preconnect links
- External `<script>` tags loaded before hydration
- `<body>` — before-app scripts (e.g. anti-flash-of-light theme detection)

Cannot use React hooks or client-side APIs here.

### 4. Data fetching
Nearly every content page uses `getStaticProps` (build-time data fetch, results baked into the HTML). Dynamic routes also declare `getStaticPaths` to enumerate which URLs to pre-render.

Example (docs):
```typescript
export async function getStaticProps({ params }) {
  const posts = require('../config/posts.json');
  const post = posts.docs.find(p => p.slug === '/' + params.slug.join('/'));
  return { props: { post } };
}

export async function getStaticPaths() {
  const posts = require('../config/posts.json');
  return {
    paths: posts.docs.map(p => ({ params: { slug: p.slug.split('/').filter(Boolean) } })),
    fallback: false,
  };
}
```

`fallback: false` — unknown slugs 404 at build time, no runtime rendering.

### 5. `[lang]` routes
Route: `pages/[lang]/index.tsx`, `pages/[lang]/docs/[[...slug]].tsx`, etc.

`getStaticPaths` for `[lang]` iterates over the locales configured in `next-i18next.config.cjs` and generates one path per locale. Content is fetched per-locale via `serverSideTranslations` (from `next-i18next`).

### 6. Redirects and rewrites
Two sources:
- `next.config.mjs` — `redirects()`, `rewrites()` at Next.js level
- `netlify.toml` — Netlify edge-level redirects (typically for cross-origin things Next doesn't handle)

`netlify.toml` also sets response headers (caching, CSP, CORS).

## Configuration

| File | Purpose |
|---|---|
| `next.config.mjs` | Next.js config — MDX loader, redirects, rewrites, image config |
| `netlify.toml` | Netlify edge redirects/headers, function config |
| `next-i18next.config.cjs` | i18n locale list + defaults |
| `pages/_app.tsx` | Global wrappers |
| `pages/_document.tsx` | HTML shell |

## Common gotchas

- **`getStaticProps` runs at build time.** New content requires a Netlify build. Preview deploys reflect PR content.
- **`getStaticPaths` with `fallback: false`** — the enumerated paths are the ONLY ones that exist. Adding a slug requires re-running the build so `getStaticPaths` sees it.
- **`_document.tsx` can't use hooks.** Add before-app scripts here, not in `_app.tsx`.
- **`_app.tsx` runs twice per navigation** (once server, once client on first paint). Idempotent code only at module scope.
- **Optional catch-all `[[...slug]]`** matches the section root (`/docs`) as well as `/docs/anything`. Regular catch-all `[...slug]` does not.
- **`require('../config/foo.json')`** loads the JSON at build time, statically. Changing the JSON at runtime does not update the page.
- **Redirects in `next.config.mjs` vs `netlify.toml`** — order of resolution: Netlify redirects first (edge), then Next.js redirects (origin). Conflicting rules can create redirect loops.
- **`_app.tsx` typically imports the header, footer, and layout wrappers directly.** Changing the layout wrapper affects every page — dangerous.

## Related topics
- [`README.md`](./README.md) — parent chapter
- [`ssr-and-hydration.md`](./ssr-and-hydration.md) — SSR-specific concerns
- [`../i18n/README.md`](../i18n/README.md) — `[lang]` routing
