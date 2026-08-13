# SSR and hydration
> Created: 2026-05-25 | Updated: 2026-05-25

## What this topic covers

Next.js Pages Router SSR/CSR boundaries in this project: what runs where, how to guard `window`-only code, when to use `next/dynamic` with `ssr: false`, and the common hydration-mismatch pitfalls.

## Key files

Every component under `pages/` and most under `components/` participates. This topic doesn't have specific files — it covers a pattern.

## How it works

### Rendering timeline
1. **Build time** — `getStaticProps` runs. HTML is generated.
2. **Server** (per request or from static cache) — HTML is served.
3. **Client** — React hydrates the HTML: it re-renders the component tree using the client's runtime and compares to the served HTML.

Mismatch between server and client → hydration error → React tears down and re-renders from scratch on the client, with a warning in the console.

### Common `window`-access patterns

**Bad — module scope**
```typescript
const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
export function Foo() { return <div className={isDark ? 'dark' : ''} />; }
```
`window` is undefined during SSR → build breaks.

**Bad — top of the component**
```typescript
export function Foo() {
  const isDark = window.matchMedia(...).matches;  // still SSR-broken
  return <div ... />;
}
```

**Good — in useEffect**
```typescript
export function Foo() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
  }, []);
  return <div className={isDark ? 'dark' : ''} />;
}
```
`useEffect` only runs client-side.

**Good — guard**
```typescript
const isDark = typeof window !== 'undefined'
  && window.matchMedia('(prefers-color-scheme: dark)').matches;
```
Works, but produces a hydration mismatch if the server-rendered HTML differs from the client-computed value on first render.

### `next/dynamic` with `ssr: false`

For components whose SSR output would necessarily differ from CSR output (client-only libraries, iframes, third-party embeds):

```typescript
import dynamic from 'next/dynamic';
const HeavyChart = dynamic(() => import('../components/HeavyChart'), { ssr: false });
```

The component is not rendered during SSR at all — a placeholder (or nothing) is rendered instead, and the real component is loaded on the client after hydration.

Used in this project for:
- `mermaid` diagrams inside MDX (see `PERFORMANCE_PLAN.md` Section H)
- `recharts` on `/finance` (Section J)
- (Ideally) `react-syntax-highlighter` (Section K — not yet done)

### `motion-reduce:` Tailwind variant

For animations that must respect `prefers-reduced-motion`, use Tailwind's built-in variant rather than `useEffect` + `matchMedia`:

```tsx
<div className="animate-spin motion-reduce:animate-none" />
```

Compiled to CSS `@media (prefers-reduced-motion: reduce)` — SSR-safe by definition, no JS involved.

## Configuration

| Config | Purpose |
|---|---|
| `next.config.mjs` | `reactStrictMode` — surfaces hydration warnings loudly in dev |
| `tailwind.config.js` | Motion variants enabled by default |

## Common gotchas

- **`Math.random()` / `Date.now()` at render time** produces different values server-side vs client-side → hydration mismatch. Use `useEffect` or a stable seed.
- **`Intl.DateTimeFormat` locale mismatch** between server and client locales causes hydration mismatch on any formatted date. Use fixed locale during SSR.
- **`useLayoutEffect` throws a warning during SSR.** Switch to `useEffect` or use `useIsomorphicLayoutEffect`.
- **`window.matchMedia` in-line pattern.** Common naïve approach — always produces hydration mismatch because server assumes light mode (no `window`) and client detects the user's actual preference. Fix: use `useEffect` + state OR use Tailwind's `dark:` variant which is media-query-driven at CSS level.
- **Cookies / localStorage at SSR** don't exist. `next-i18next` handles locale cookies correctly; hand-rolled cookie readers usually don't.
- **Third-party scripts that inject DOM** (analytics, chat widgets) load client-side only, but their placeholder must be rendered SSR-side too or the layout shifts.
- **MDX with `dynamic({ ssr: false })` components** hidden inside will not appear in the static HTML but WILL appear after hydration — can cause layout jumps.
- **Netlify preview vs prod** — differences in env vars can cause behaviour that renders fine in prod but crashes in preview (or vice versa).

## Related topics
- [`README.md`](./README.md) — parent chapter
- [`pages-router.md`](./pages-router.md) — where SSR lives in the Next.js pipeline
- `../docs-and-blog/mdx-pipeline.md` — MDX components that may need `dynamic({ ssr: false })`
