# Internationalisation — Chapter Overview
> Created: 2026-05-25 | Updated: 2026-05-25

## What this chapter covers

Multi-language support via `next-i18next`. Translation JSON files, the `[lang]` route pattern, and the language selector component.

Read this chapter for any task touching translated strings, the language selector, `pages/[lang]/**`, or `next-i18next.config.cjs`.

## Key files

| File | Role |
|------|------|
| `next-i18next.config.cjs` | Locale list, default locale, namespaces |
| `public/locales/{lang}/` | Translation JSON files per locale, per namespace |
| `pages/[lang]/**` | Localised route tree — mirrors non-`[lang]` pages |
| `components/languageSelector/` | UI for switching language |
| `ADDING_TRANSLATIONS.md` | Contributor guide for adding a new locale |

## Pattern

- Every user-visible string routed through `useTranslation('namespace')` — no hardcoded English.
- Translation keys are namespaced by page/component (e.g. `common`, `landing-page`, `docs`).
- `[lang]` routes duplicate the top-level pages, with `getStaticPaths` producing one path per supported locale.

## Common gotchas

- **Missing translation keys** fall back silently to English — no build error. Verify in the target locale.
- **Locale codes** must match `next-i18next.config.cjs` exactly (case-sensitive). Mismatch = 404.
- **Not all pages are localised** — check `[lang]/` exists for a given page before adding a translation.
- **Locale-specific images** (e.g. RTL) not supported — visual assets are shared.

## Related chapters
- `frontend` — page structure
- `docs-and-blog` — how docs handle locales
