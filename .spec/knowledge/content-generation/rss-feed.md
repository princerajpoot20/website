# RSS feed generation
> Created: 2026-05-25 | Updated: 2026-05-25

## What this topic covers

How `scripts/build-rss.ts` reads the blog posts from `config/posts.json` and produces `public/rss.xml`. Runs at `next build` time, invoked from `scripts/index.ts` immediately after `buildPostList`.

## Key files

| File | Role |
|------|------|
| `scripts/build-rss.ts` | Owns `rssFeed`. Only one exported function. |
| `config/posts.json` | Input — produced by [`posts-and-navigation.md`](./posts-and-navigation.md) |
| `public/rss.xml` | Output — served directly by Netlify |

## How it works

### 1. Load and filter posts
`getAllPosts()` dynamic-imports `../config/posts.json`. `rssFeed(type, ...)` picks the branch (`blog` in production; the function is generic and supports other blog-post types).

Posts without a `date` are filtered out. Missing `date` also causes a throw at the top of the pipeline if any survive filter — the check duplicates but produces a clearer error message.

### 2. Sort
Posts are sorted:
1. Featured posts first (`i1.featured && !i2.featured` → sort earlier)
2. Then by `date` descending (newest first)

### 3. Validate required fields
After sorting, every post is checked for `title`, `slug`, `excerpt`, `date`. Any missing field throws `"Missing required fields in posts: ..."` naming the offenders.

### 4. Build the RSS envelope
Constructs an `RSS` object:
- `@version: '2.0'`, `@xmlns:atom: 'http://www.w3.org/2005/Atom'`
- `channel.title` = the argument passed by the caller (`AsyncAPI Initiative Blog RSS Feed`)
- `channel.link` = `https://www.asyncapi.com/{outputPath}` (i.e. `rss.xml`)
- `channel.atom:link` = self-link (`@rel: 'self'`, `@href: link`, `@type: 'application/rss+xml'`)
- `channel.description` = argument
- Static fields: `language: 'en-gb'`, `copyright`, `webMaster: 'info@asyncapi.com (AsyncAPI Initiative)'`, `pubDate: now`, `generator: 'next.js'`
- `channel.item = []`

### 5. Populate items
For each post, an `RSSItemType` is constructed:
- `title`, `description = he.decode(excerpt)` (HTML-entities decoded via `he`)
- `link = base + slug + '?utm_source=rss'` (tracking param)
- `category = type` (`blog`)
- `guid = { '@isPermaLink': true, '': link }`
- `pubDate = new Date(date).toUTCString()`

If the post has a `cover` image, an `enclosure` is added:
- `@url = base + cover`
- `@length = 15026` (a dummy value — the tag needs *something*; RSS readers rarely use it strictly)
- `@type = mimeTypes[extension]` — looked up from a small map covering jpeg, jpg, png, svg, webp, gif, bmp, tiff, ico; unknown → `'image/jpeg'`

### 6. Serialise and write
`json2xml.getXml(feed, '@', '', 2)` produces the XML string. Written via `fs.writeFile(\`./public/${outputPath}\`, xml, 'utf8')`.

## Configuration

| Argument | Purpose |
|---|---|
| `type` | Which posts array to read from `posts.json` (only `blog` is used today) |
| `rssTitle` | `channel.title` |
| `desc` | `channel.description` |
| `outputPath` | Filename under `public/` (e.g. `rss.xml`) |

Constants at module scope:
- `base = 'https://www.asyncapi.com'`
- `tracking = '?utm_source=rss'`

## Common gotchas

- **`enclosure @length = 15026`** — hard-coded dummy value. Some strict RSS validators complain, but Feedly and NetNewsWire accept it. Change requires reading each file's actual byte size.
- **HTML entities in the excerpt.** `he.decode` runs on `excerpt` to unescape entities before serialising as RSS text. If a post's excerpt contains raw XML control chars, they'll break the feed.
- **`utm_source=rss` tracking param** appended to every link. Search-engine dedupers should normalise it away.
- **Missing-date posts throw twice.** First filter removes them; then a check throws with their titles. Both should never trigger together, but the second is a belt-and-braces guard.
- **The generic function signature accepts a `type` argument**, but only `blog` is actually invoked from `scripts/index.ts`. Adding `about` or `docs` as RSS types would work at the code level, but not all pages have `excerpt`/`date` in front-matter.

## Related topics
- [`posts-and-navigation.md`](./posts-and-navigation.md) — produces `posts.json`
- [`README.md`](./README.md) — parent chapter
