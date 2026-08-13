# Design tokens
> Created: 2026-05-25 | Updated: 2026-05-25

## What this topic covers

The Tailwind design token system: how colours, spacing, fonts, and breakpoints are defined once in `tailwind.config.js` and referenced by name throughout components. Includes the dark-mode strategy and how external fonts and stylesheets are loaded.

## Key files

| File | Role |
|------|------|
| `tailwind.config.js` | Design token definitions (colors, spacing, fonts, breakpoints, custom animations) |
| `styles/globals.css` | Global CSS, external stylesheet imports, custom CSS variables |
| `postcss.config.cjs` | PostCSS pipeline (Tailwind, autoprefixer) |
| `mdx-components.tsx` | Applies design-token classes to MDX-rendered HTML elements |

## How it works

### 1. Colour tokens
Colours are defined in `tailwind.config.js` under `theme.extend.colors`:

```javascript
theme: {
  extend: {
    colors: {
      primary: '#...',
      secondary: '#...',
      dark: '#...',
      // ...brand palette
    },
  },
},
```

Usage: `className="bg-primary text-secondary hover:bg-dark"` — never raw hex.

### 2. Dark mode
Configured via `darkMode: 'class'` (or `'media'` depending on the setting) in `tailwind.config.js`. The `dark:` variant is applied when the class is present on `<html>` (class mode) or when `prefers-color-scheme: dark` matches (media mode).

Typical usage in components:
```tsx
<div className="bg-white text-black dark:bg-dark dark:text-white" />
```

The classes for dark mode should always use *tokens* (`dark:bg-dark`), not raw values (`dark:bg-gray-900`), to keep dark-mode consistency across the site.

Theme toggle (if using class mode) is handled by `components/DarkModeToggle.tsx` — flips a class on `<html>`.

### 3. Fonts
Fonts are declared in `styles/globals.css` (imported from external CDNs) or in `pages/_document.tsx` (preloaded via `<link>`).

Currently loaded fonts:
- Google Fonts (Inter / etc.) — from `fonts.googleapis.com`
- Fira Code from jsDelivr CDN

Both are render-blocking. See `PERFORMANCE_PLAN.md` Sections A and M for the self-host + preload fix.

### 4. Spacing and breakpoints
Standard Tailwind scale + a few extras in `theme.extend.spacing` and `theme.extend.screens` for project-specific breakpoints.

### 5. Custom animations
Defined in `theme.extend.animation` and `theme.extend.keyframes`. Common ones include the landing page's demo animation and hover transitions.

## Configuration

| File | Purpose |
|---|---|
| `tailwind.config.js` | All design tokens |
| `styles/globals.css` | Global CSS + font imports |
| `pages/_document.tsx` | Font preload hints |
| `postcss.config.cjs` | Tailwind + autoprefixer |

## Common gotchas

- **Raw hex in `className` bypasses tokens.** `bg-[#123456]` works with Tailwind arbitrary values but breaks the token discipline. Reserve for very-one-off cases; prefer adding a token if it appears twice.
- **`dark:` variants require both light and dark classes.** Missing the base class produces "transparent → dark" (from unset). Missing the `dark:` class produces light styling in dark mode.
- **`tools-object.ts` and `tags-color.ts` bypass tokens.** Tool tag colours are defined as Tailwind arbitrary values (`bg-[#8ECFDF]`) directly in the data files — not from tokens. Deliberate — each tool tag has a brand-derived colour independent of the site palette.
- **Font-loading via CSS `@import`** is render-blocking. `<link rel="preload">` in `_document.tsx` mitigates but doesn't fully solve.
- **Dark mode class toggle races SSR.** On first paint, the server doesn't know user preference — either flash-of-wrong-theme or a pre-hydration inline script to detect early. Currently the site uses the pre-hydration script approach in `_document.tsx`.
- **PurgeCSS strips unused classes.** Tailwind purges classes not statically detectable. Dynamic classes (`className={\`bg-${color}\`}`) get purged — use `safelist` in the Tailwind config or precompute the class name.
- **`postcss.config.cjs` uses `.cjs` extension** because Next 15 with ESM changed the resolution. If renamed to `.js`, breaks the build.

## Related topics
- [`README.md`](./README.md) — parent chapter
- [`ssr-and-hydration.md`](./ssr-and-hydration.md) — dark-mode toggle SSR concerns
- `../docs-and-blog/mdx-pipeline.md` — how design tokens are applied to MDX content
