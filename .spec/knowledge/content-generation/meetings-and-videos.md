# Meetings and videos
> Created: 2026-05-25 | Updated: 2026-05-25

## What this topic covers

Two generators invoked on the same daily workflow (`regenerate-meetings-and-videos.yml`):
- `build-meetings.ts` — Google Calendar → `config/meetings.json`
- `build-newsroom-videos.ts` — YouTube channel → `config/newsroom_videos.json`

For the dashboard generator that also runs on the same workflow, see the [`dashboard`](../dashboard/README.md) chapter.

## Key files

| File | Role |
|------|------|
| `scripts/build-meetings.ts` | Owns `buildMeetings(writePath)` |
| `scripts/build-newsroom-videos.ts` | Owns `buildNewsroomVideos(writePath)` |
| `config/meetings.json` | Output — used by `pages/community/*` and meetings widgets |
| `config/newsroom_videos.json` | Output — used by the newsroom section |

## How each works

### `build-meetings.ts` — Google Calendar

**Auth.** Constructs a `google.auth.GoogleAuth` with scope `https://www.googleapis.com/auth/calendar` and `JSON.parse(process.env.CALENDAR_SERVICE_ACCOUNT)` as credentials. `google.calendar({ version: 'v3', auth })` produces the client. Throws `"Authentication failed: ..."` on setup errors, `"CALENDAR_SERVICE_ACCOUNT environment variable is not set"` if the env is missing (same for `CALENDAR_ID`).

**Time window.** Fetches events from 100 days in the past to 30 days in the future:
```typescript
const currentTime = new Date(Date.now()).toISOString();
const timeMin = new Date(Date.parse(currentTime) - 100 * 86400_000).toISOString();
const timeMax = new Date(Date.parse(currentTime) + 30 * 86400_000).toISOString();
```

**Fetch.** `calendar.events.list({ calendarId, timeMin, timeMax })`.

**Validate.** Throws `"Invalid data structure received from Google Calendar API"` if `eventsList.data.items` is missing or not an array. Throws `"start.dateTime is missing in the event"` if any event lacks `start.dateTime`.

**Transform.** Maps every event to:
```typescript
{
  title: e.summary,
  calLink: e.htmlLink,
  url: e.extendedProperties?.private
    ? `https://github.com/asyncapi/community/issues/${e.extendedProperties.private.ISSUE_ID}`
    : undefined,
  banner: e.extendedProperties?.private?.BANNER,
  date: new Date(e.start.dateTime),
}
```

Two of the fields use Calendar `extendedProperties.private` — `ISSUE_ID` links back to the community-repo issue for that meeting, `BANNER` is the promotional image path.

**Write.** `JSON.stringify(eventsItems, null, '  ')` (2-space indent), then `writeFileSync`.

### `build-newsroom-videos.ts` — YouTube

**Auth.** Requires `YOUTUBE_TOKEN` env; throws `"YOUTUBE_TOKEN environment variable is required"` otherwise.

**Fetch.** Single HTTP GET to `https://youtube.googleapis.com/youtube/v3/search`:
- `key`: YOUTUBE_TOKEN
- `part: 'snippet'`
- `channelId: 'UCIz9zGwDLbrYQcDKVXdOstQ'` (AsyncAPI channel)
- `eventType: 'completed'` (finished streams / archived content only)
- `type: 'video'`
- `order: 'Date'`
- `maxResults: '5'`

**Validate.** Throws on non-`ok` HTTP status. Throws `"Invalid data structure received from YouTube API"` if `data.items` is not an array.

**Transform.** For each video:
```typescript
{
  image_url: video.snippet?.thumbnails?.high?.url,
  title: video.snippet?.title,
  description: video.snippet?.description,
  videoId: video.id?.videoId,
}
```

**Write.** Same pattern as meetings — 2-space JSON, `writeFileSync`. Also returns the JSON string (unused by production caller).

## Configuration

| Var / arg | Purpose |
|---|---|
| `CALENDAR_ID` env | Google Calendar ID for the meetings feed |
| `CALENDAR_SERVICE_ACCOUNT` env | Google service-account JSON credentials (must be JSON.parse-able string) |
| `YOUTUBE_TOKEN` env | YouTube Data API key |
| Time window | Hardcoded ±100/30 days in meetings script |
| YouTube channel id | Hardcoded `UCIz9zGwDLbrYQcDKVXdOstQ` in videos script |
| Video count | Hardcoded `maxResults: '5'` in videos script |

## Common gotchas

- **Meetings time window is fixed.** 100 days back + 30 days forward. Older meetings will disappear from the JSON; UI shouldn't depend on data older than ~3 months.
- **Extended properties are optional.** `url` and `banner` are undefined when the calendar entry lacks the properties. Frontend must handle absent values.
- **YouTube fetch is a single page.** `maxResults: '5'` is the hard cap in one request. To get more videos would require pagination via `pageToken` (not currently implemented).
- **YouTube `eventType: 'completed'` filters to archived streams.** Uploaded regular videos may not appear; live streams-in-progress don't appear.
- **Meetings `date` is stored as a `Date` object, not a string.** After `JSON.stringify`, it serialises to ISO string — but the intermediate object handed to `writeFileSync` isn't a raw string.
- **`title` from YouTube may include HTML entities** (e.g. `&amp;`). Not decoded before writing — the frontend is responsible.
- **`calendar.events.list` does NOT paginate by default.** Google returns up to 250 events; the current time window won't approach that limit for AsyncAPI's cadence.
- **Google service-account requires calendar sharing.** The calendar ID must be shared with the service account's email address, or the API returns 404.

## Related topics
- [`README.md`](./README.md) — parent chapter
- `../dashboard/README.md` — the third generator on the same workflow
- `../workflows/regenerate-meetings-videos-dashboard.md` — orchestration
