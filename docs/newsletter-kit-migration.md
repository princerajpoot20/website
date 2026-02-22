# Newsletter Service: Mailchimp to Kit.com Migration

## Table of Contents

- [1. Overview](#1-overview)
- [2. Architecture](#2-architecture)
  - [2.1 High-Level Architecture](#21-high-level-architecture)
  - [2.2 Component Breakdown](#22-component-breakdown)
  - [2.3 Data Flow: Website Subscription](#23-data-flow-website-subscription)
  - [2.4 Data Flow: TSC Email Notification](#24-data-flow-tsc-email-notification)
- [3. Kit.com API Reference](#3-kitcom-api-reference)
  - [3.1 API Base URL and Authentication](#31-api-base-url-and-authentication)
  - [3.2 Create a Subscriber](#32-create-a-subscriber)
  - [3.3 Tag a Subscriber by Email](#33-tag-a-subscriber-by-email)
  - [3.4 Create a Broadcast](#34-create-a-broadcast)
  - [3.5 API Rate Limits](#35-api-rate-limits)
  - [3.6 Response Codes](#36-response-codes)
- [4. Concept Mapping: Mailchimp vs Kit.com](#4-concept-mapping-mailchimp-vs-kitcom)
- [5. File-by-File Implementation Details](#5-file-by-file-implementation-details)
  - [5.1 config/kit-config.json](#51-configkit-configjson)
  - [5.2 netlify/functions/newsletter_subscription.ts](#52-netlifyfunctionsnewsletter_subscriptionts)
  - [5.3 components/NewsletterSubscribe.tsx](#53-componentsnewslettersubscribetsx)
  - [5.4 .github/workflows/scripts/kit/index.js](#54-githubworkflowsscriptskitindexjs)
  - [5.5 .github/workflows/scripts/kit/htmlContent.js](#55-githubworkflowsscriptskithtmlcontentjs)
  - [5.6 .github/workflows/notify-tsc-members-mention.yml](#56-githubworkflowsnotify-tsc-members-mentionyml)
- [6. Environment Variables](#6-environment-variables)
  - [6.1 Netlify Environment Variables](#61-netlify-environment-variables)
  - [6.2 GitHub Actions Secrets](#62-github-actions-secrets)
- [7. Setup Guide](#7-setup-guide)
  - [7.1 Kit.com Account Setup](#71-kitcom-account-setup)
  - [7.2 Create Tags in Kit.com](#72-create-tags-in-kitcom)
  - [7.3 Configure the Repository](#73-configure-the-repository)
  - [7.4 Set Environment Variables](#74-set-environment-variables)
  - [7.5 Verify the Migration](#75-verify-the-migration)
- [8. Migration Changelog](#8-migration-changelog)
  - [8.1 Files Created](#81-files-created)
  - [8.2 Files Modified](#82-files-modified)
  - [8.3 Files Deleted](#83-files-deleted)
  - [8.4 Dependencies Removed](#84-dependencies-removed)
- [9. Kit.com API Documentation Reference](#9-kitcom-api-documentation-reference)

---

## 1. Overview

The AsyncAPI website newsletter service has been migrated from **Mailchimp** to **Kit.com** (formerly ConvertKit). This service handles two primary functions:

1. **Website Newsletter Subscriptions** -- Users subscribe to newsletters (Newsletter, Meetings, TSC Voting) through a form on the website. Subscriptions are processed by a Netlify serverless function that calls the Kit.com API.

2. **TSC Email Notifications** -- When `@asyncapi/tsc_members` is mentioned in a GitHub issue, pull request, or discussion, an automated email broadcast is sent to all subscribers tagged with "TSC Voting" via a GitHub Actions workflow.

**Why Kit.com?**

- Kit.com provides a modern V4 REST API that is simpler than Mailchimp's SDK-based approach.
- No SDK dependency required -- native `fetch` calls are sufficient.
- Tag-based subscriber segmentation replaces Mailchimp's interest groups.
- Broadcast creation is a single API call instead of Mailchimp's 3-step process (create campaign, set content, schedule).
- Kit.com automatically handles email template wrapping, unsubscribe links, and CAN-SPAM compliance.

---

## 2. Architecture

### 2.1 High-Level Architecture

```
+---------------------+          +----------------------------+          +------------------+
|                     |          |                            |          |                  |
|   AsyncAPI Website  |  POST   |  Netlify Serverless Func   |  REST   |   Kit.com V4 API |
|   (React Frontend)  +--------->  newsletter_subscription.ts +--------->                  |
|                     |          |                            |          |   api.kit.com/v4 |
+---------------------+          +----------------------------+          +--------+---------+
                                                                                  |
                                                                         Creates subscriber
                                                                         + applies tag
                                                                                  |
                                                                         +--------v---------+
                                                                         |                  |
                                                                         |  Kit.com          |
                                                                         |  Subscriber List  |
                                                                         |                  |
                                                                         +--------+---------+
                                                                                  ^
+---------------------+          +----------------------------+                   |
|                     |          |                            |          Creates broadcast
|   GitHub Events     | trigger  |  GitHub Actions Workflow   |  REST   targeted by tag
|   (Issues, PRs,     +--------->  scripts/kit/index.js      +----------+
|    Discussions)     |          |                            |
+---------------------+          +----------------------------+
```

### 2.2 Component Breakdown

| Component | File | Runtime | Purpose |
|---|---|---|---|
| **Frontend Form** | `components/NewsletterSubscribe.tsx` | Browser (React) | Collects name, email, and subscription type from users |
| **Subscription API** | `netlify/functions/newsletter_subscription.ts` | Netlify Functions (Node.js) | Creates subscribers and tags them in Kit.com |
| **Tag Configuration** | `config/kit-config.json` | Static JSON | Maps subscription types to Kit.com tag IDs |
| **Broadcast Script** | `.github/workflows/scripts/kit/index.js` | GitHub Actions (Node.js 20) | Creates and schedules Kit.com broadcast emails |
| **Email Template** | `.github/workflows/scripts/kit/htmlContent.js` | GitHub Actions (Node.js 20) | Generates HTML content for TSC notification emails |
| **Workflow** | `.github/workflows/notify-tsc-members-mention.yml` | GitHub Actions | Orchestrates Slack + Kit.com email notifications |

### 2.3 Data Flow: Website Subscription

```
User fills form on website
        |
        v
NewsletterSubscribe.tsx sends POST to /.netlify/functions/newsletter_subscription
  Body: { name: "Alice", email: "alice@example.com", interest: "Newsletter" }
        |
        v
newsletter_subscription.ts (Netlify Function)
        |
        +---> Step 1: POST https://api.kit.com/v4/subscribers
        |     Headers: { X-Kit-Api-Key: <KIT_API_KEY> }
        |     Body: { email_address: "alice@example.com", first_name: "Alice", state: "active" }
        |     Response: 200 (existing) or 201 (new subscriber)
        |
        +---> Step 2: POST https://api.kit.com/v4/tags/{tag_id}/subscribers
        |     Headers: { X-Kit-Api-Key: <KIT_API_KEY> }
        |     Body: { email_address: "alice@example.com" }
        |     Response: 200 (already tagged) or 201 (newly tagged)
        |
        v
Returns 200 with subscriber data to frontend
        |
        v
NewsletterSubscribe.tsx shows success message
```

### 2.4 Data Flow: TSC Email Notification

```
GitHub event triggers (issue/PR/discussion containing @asyncapi/tsc_members)
        |
        v
notify-tsc-members-mention.yml workflow starts
        |
        +---> Slack notification (unchanged)
        |
        +---> Kit.com email notification:
              |
              v
        scripts/kit/index.js
              |
              +---> Compute schedule time (next full hour)
              |
              +---> POST https://api.kit.com/v4/broadcasts
              |     Headers: { X-Kit-Api-Key: <KIT_API_KEY> }
              |     Body: {
              |       subject: "TSC attention required: <title>",
              |       content: <htmlContent>,
              |       send_at: "<next-hour-ISO8601>",
              |       subscriber_filter: [{ all: [{ type: "tag", ids: [TSC_TAG_ID] }], any: null, none: null }]
              |     }
              |     Response: 201 (broadcast created and scheduled)
              |
              v
        Email is scheduled and sent to all "TSC Voting" tagged subscribers at the next full hour
```

---

## 3. Kit.com API Reference

All API calls use the **Kit.com V4 REST API**. Full official documentation is available at [https://developers.kit.com/api-reference/overview](https://developers.kit.com/api-reference/overview).

### 3.1 API Base URL and Authentication

- **Base URL**: `https://api.kit.com/v4`
- **Authentication**: API Key via HTTP header

```
X-Kit-Api-Key: <YOUR_V4_API_KEY>
```

API keys are created in the Kit.com dashboard under [Developer Settings](https://app.kit.com/account_settings/developer_settings).

Kit.com also supports OAuth 2.0 for apps, but for server-to-server integrations like ours, API key authentication is recommended.

**Rate Limits (API Key)**: 120 requests per rolling 60-second window per API key.

### 3.2 Create a Subscriber

Creates a new subscriber or updates an existing one (upsert behavior by email address).

**Used in**: `netlify/functions/newsletter_subscription.ts`

```
POST /v4/subscribers
```

**Request Headers**:
```
Content-Type: application/json
X-Kit-Api-Key: <API_KEY>
```

**Request Body**:
```json
{
  "email_address": "alice@example.com",
  "first_name": "Alice",
  "state": "active"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `email_address` | string | Yes | The subscriber's email address |
| `first_name` | string | No | The subscriber's first name |
| `state` | string | No | One of: `active`, `cancelled`, `bounced`, `complained`, `inactive`. Defaults to `active` |
| `fields` | object | No | Custom field key-value pairs |

**Response (201 Created)**:
```json
{
  "subscriber": {
    "id": 286,
    "first_name": "Alice",
    "email_address": "alice@example.com",
    "state": "active",
    "created_at": "2023-02-17T11:43:55Z",
    "fields": {}
  }
}
```

**Response (200 OK)** -- Subscriber already exists (first name updated):
```json
{
  "subscriber": {
    "id": 288,
    "first_name": "Alice",
    "email_address": "alice@example.com",
    "state": "active",
    "created_at": "2023-02-17T11:43:55Z",
    "fields": {}
  }
}
```

**Error Responses**:
- `401`: Invalid API key
- `422`: Invalid parameters (e.g., invalid email format)

**Official docs**: [Create a subscriber](https://developers.kit.com/api-reference/subscribers/create-a-subscriber)

---

### 3.3 Tag a Subscriber by Email

Applies a tag to an existing subscriber identified by email address. The subscriber must already exist (created via the endpoint above).

**Used in**: `netlify/functions/newsletter_subscription.ts`

```
POST /v4/tags/{tag_id}/subscribers
```

**Path Parameters**:
| Parameter | Type | Description |
|---|---|---|
| `tag_id` | integer | The numeric ID of the tag |

**Request Headers**:
```
Content-Type: application/json
X-Kit-Api-Key: <API_KEY>
```

**Request Body**:
```json
{
  "email_address": "alice@example.com"
}
```

**Response (201 Created)** -- Tag applied:
```json
{
  "subscriber": {
    "id": 1104,
    "first_name": "Alice",
    "email_address": "alice@example.com",
    "state": "active",
    "created_at": "2023-02-17T11:43:55Z",
    "tagged_at": "2023-02-17T11:43:55Z",
    "fields": {}
  }
}
```

**Response (200 OK)** -- Subscriber already has this tag (idempotent):
```json
{
  "subscriber": {
    "id": 1103,
    "first_name": "Alice",
    "email_address": "alice@example.com",
    "state": "active",
    "created_at": "2023-02-17T11:43:55Z",
    "tagged_at": "2023-02-17T11:43:55Z",
    "fields": {}
  }
}
```

**Error Responses**:
- `401`: Invalid API key
- `404`: Tag ID does not exist
- `422`: Missing email address

**Official docs**: [Tag a subscriber by email address](https://developers.kit.com/api-reference/tags/tag-a-subscriber-by-email-address)

---

### 3.4 Create a Broadcast

Creates and optionally schedules an email broadcast to a filtered set of subscribers.

**Used in**: `.github/workflows/scripts/kit/index.js`

```
POST /v4/broadcasts
```

**Request Headers**:
```
Content-Type: application/json
X-Kit-Api-Key: <API_KEY>
```

**Request Body**:
```json
{
  "subject": "TSC attention required: Issue Title",
  "content": "<p>HTML email body content</p>",
  "description": "Internal description for this broadcast",
  "public": false,
  "published_at": "2024-01-15T10:00:00Z",
  "send_at": "2024-01-15T11:00:00Z",
  "preview_text": "Short preview shown in email clients",
  "subscriber_filter": [
    {
      "all": [{ "type": "tag", "ids": [12345] }],
      "any": null,
      "none": null
    }
  ]
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `subject` | string | Yes | Email subject line |
| `content` | string | Yes | HTML content of the email body. Kit.com wraps this in the account's email template |
| `description` | string | Yes | Internal description (not shown to subscribers) |
| `public` | boolean | Yes | If `true`, broadcast is published to the web (Creator Profile / Landing Pages) |
| `published_at` | string | Yes | ISO8601 timestamp for the published date |
| `send_at` | string\|null | No | ISO8601 timestamp to schedule the send. `null` saves as draft |
| `preview_text` | string | Yes | Preview text shown in email clients |
| `subscriber_filter` | array | Yes | Filters which subscribers receive the broadcast |
| `email_template_id` | integer | No | Email template to use. Defaults to account's default template |
| `email_address` | string | No | Sending email address. Defaults to account's sending address |
| `thumbnail_alt` | string | No | Alt text for thumbnail image |
| `thumbnail_url` | string | No | URL for thumbnail image |

**Subscriber Filter Format**:

The `subscriber_filter` is an array of filter group objects. Each group must contain `all`, `any`, and `none` (the latter two can be `null`). Only one filter group type is supported per request.

```json
[
  {
    "all": [
      { "type": "tag", "ids": [TAG_ID_1, TAG_ID_2] },
      { "type": "segment", "ids": [SEGMENT_ID] }
    ],
    "any": null,
    "none": null
  }
]
```

- **`all`**: Logical AND -- subscriber must match ALL specified tags/segments
- **`any`**: Logical OR -- subscriber must match at least ONE tag/segment
- **`none`**: Logical NOT -- subscriber must NOT match any of the specified tags/segments

**Response (201 Created)**:
```json
{
  "broadcast": {
    "id": 27,
    "publication_id": 27,
    "created_at": "2023-02-17T11:43:55Z",
    "subject": "TSC attention required: Issue Title",
    "preview_text": "Check out the latest topic...",
    "description": "New topic info - Mon, 15 Jan 2024 10:00:00 GMT",
    "content": "<p>HTML content</p>",
    "public": false,
    "published_at": "2024-01-15T10:00:00Z",
    "send_at": "2024-01-15T11:00:00Z",
    "thumbnail_alt": null,
    "thumbnail_url": null,
    "public_url": "https://creator.kit.com/posts/...",
    "email_address": "from@example.com",
    "email_template": {
      "id": 2,
      "name": "Classic"
    },
    "subscriber_filter": [
      {
        "all": [
          { "type": "tag", "ids": [12345] }
        ]
      }
    ]
  }
}
```

**Error Responses**:
- `401`: Invalid API key
- `403`: Account not authorized to create broadcasts (plan limitation)
- `422`: Invalid parameters (e.g., "Email template not found", "Only a single filter group is supported")

**Official docs**: [Create a broadcast](https://developers.kit.com/api-reference/broadcasts/create-a-broadcast)

---

### 3.5 API Rate Limits

| Auth Method | Limit |
|---|---|
| API Key | 120 requests per rolling 60 seconds |
| OAuth 2.0 | 600 requests per rolling 60 seconds |

Our implementation uses API Key authentication. Given our usage patterns (individual subscriptions and occasional broadcasts), we are well within these limits.

### 3.6 Response Codes

| Code | Meaning |
|---|---|
| `200` | Success -- resource already existed or was updated |
| `201` | Success -- new resource created |
| `202` | Accepted -- async processing (e.g., > 10 custom fields) |
| `401` | Unauthorized -- invalid API key or token |
| `403` | Forbidden -- account plan does not support this action |
| `404` | Not Found -- referenced resource does not exist |
| `422` | Unprocessable Entity -- invalid parameters |
| `429` | Too Many Requests -- rate limit exceeded |

---

## 4. Concept Mapping: Mailchimp vs Kit.com

| Concept | Mailchimp (Old) | Kit.com (New) |
|---|---|---|
| **Subscriber List** | Audience/List with `listId: "6e3e437abe"` | Flat subscriber list (no separate lists needed) |
| **Subscriber Identification** | MD5 hash of lowercase email | Direct email address |
| **Subscriber Grouping** | Interest Groups (`interests` object with Mailchimp group IDs) | Tags with numeric IDs |
| **Name Field** | Merge field `FNAME` | `first_name` field on subscriber |
| **Email Campaigns** | Campaigns (create -> setContent -> schedule: 3 API calls) | Broadcasts (single API call with `send_at`) |
| **Campaign Targeting** | Segment conditions on interest groups | `subscriber_filter` with tag IDs |
| **Email Personalization** | Mailchimp merge tags: `*\|FNAME\|*` | Liquid syntax: `{{ subscriber.first_name }}` |
| **Unsubscribe Links** | Mailchimp merge tag: `*\|UNSUB\|*` | Handled automatically by Kit.com email templates |
| **Profile Update** | Mailchimp merge tag: `*\|UPDATE_PROFILE\|*` | Handled automatically by Kit.com email templates |
| **Email Template** | Full HTML document (500+ lines with MSO conditionals) | Body content only; Kit.com wraps in its own template |
| **API Authentication** | `MAILCHIMP_API_KEY` + server prefix (`us12`) | `KIT_API_KEY` via `X-Kit-Api-Key` header |
| **SDK / HTTP Client** | `@mailchimp/mailchimp_marketing` npm package | Native `fetch` (zero dependencies) |
| **API Base** | `https://us12.api.mailchimp.com/3.0` | `https://api.kit.com/v4` |

**Subscription Type to Tag Mapping**:

| Subscription Type | Mailchimp Interest Group ID | Kit.com Tag Name | Kit.com Tag ID |
|---|---|---|---|
| Newsletter | `a7d6314955` | Newsletter | _To be configured_ |
| Meetings | `3505cd49d1` | Meetings | _To be configured_ |
| TSC Voting | `f7204f9b90` | TSC Voting | _To be configured_ |

---

## 5. File-by-File Implementation Details

### 5.1 config/kit-config.json

**Path**: `config/kit-config.json`
**Replaces**: `config/mailchimp-config.json`

Maps subscription interest types (used by the website form) to Kit.com tag IDs.

```json
{
  "tags": {
    "Newsletter": 0,
    "Meetings": 0,
    "TSC Voting": 0
  }
}
```

The `0` values are placeholders. Replace them with the actual numeric tag IDs from your Kit.com account after creating the tags (see [Setup Guide](#7-setup-guide)).

**Key difference from old config**: The old `mailchimp-config.json` had a `listId` and `interests` object with string IDs. Kit.com has no concept of separate lists -- all subscribers are in a single account-level list, segmented by tags.

---

### 5.2 netlify/functions/newsletter_subscription.ts

**Path**: `netlify/functions/newsletter_subscription.ts`
**Runtime**: Netlify Functions (Node.js 18+)
**Triggered by**: `POST /.netlify/functions/newsletter_subscription`

This is the core serverless function that handles subscription requests from the website.

**Request Format** (from the frontend):
```json
{
  "name": "Alice",
  "email": "alice@example.com",
  "interest": "Newsletter"
}
```

**Processing Steps**:

1. **Validate HTTP method** -- Only `POST` is accepted (returns `405` otherwise)
2. **Validate API key** -- Checks `KIT_API_KEY` environment variable (returns `500` if missing)
3. **Validate input** -- Checks that `email` is present (returns `422` if missing)
4. **Create/upsert subscriber** -- Calls `POST /v4/subscribers` with email, name, and state
5. **Tag subscriber** -- Looks up the tag ID from `kit-config.json` and calls `POST /v4/tags/{tag_id}/subscribers`
6. **Return response** -- Returns the subscriber data to the frontend

**Error handling**:
- Kit.com API errors are forwarded with the original status code and error body
- Network/runtime errors return `500` with the error message
- The function uses typed error handling (`catch (err: unknown)`)

**Key differences from old implementation**:
- No `@mailchimp/mailchimp_marketing` SDK import
- No `md5` import (Kit.com uses email directly, not an MD5 hash)
- No `mailchimp.setConfig()` call
- Two sequential API calls (create subscriber, then tag) instead of one Mailchimp `setListMember()` call
- Proper HTTP method validation (returns `405` instead of `500`)
- Input validation for missing email

---

### 5.3 components/NewsletterSubscribe.tsx

**Path**: `components/NewsletterSubscribe.tsx`
**Runtime**: Browser (React)
**Status**: **Unchanged** -- No modifications needed

This React component renders the subscription form and is used on the newsletter page and other places across the site. It collects the user's name and email, then submits to the Netlify function endpoint.

The component is decoupled from the email service implementation -- it only knows about the Netlify function URL (`/.netlify/functions/newsletter_subscription`) and the request format `{ name, email, interest }`. Since the Netlify function's endpoint URL and request/response contract remain the same, no frontend changes were required.

**Form states**: `normal` -> `loading` -> `success` | `error`

The `type` prop controls the subscription interest type:
- Default: `"Newsletter"`
- Also used with: `"Meetings"`, `"TSC Voting"`

---

### 5.4 .github/workflows/scripts/kit/index.js

**Path**: `.github/workflows/scripts/kit/index.js`
**Replaces**: `.github/workflows/scripts/mailchimp/index.js`
**Runtime**: GitHub Actions (Node.js 20)

Creates and schedules a Kit.com broadcast when TSC members are mentioned in GitHub.

**Input**: `(link, title)` -- URL to the GitHub resource and its title

**Processing Steps**:

1. **Validate environment** -- Checks `KIT_API_KEY` and `KIT_TAG_ID_TSC_VOTING` env vars
2. **Calculate schedule time** -- Rounds up to the next full hour (e.g., 9:46 -> 10:00)
3. **Create broadcast** -- Single `POST /v4/broadcasts` call with:
   - Subject line containing the title
   - HTML content from `htmlContent.js`
   - Schedule time via `send_at`
   - Subscriber filter targeting the TSC Voting tag

**Key differences from old implementation**:
- **One API call instead of three**: Mailchimp required `campaigns.create()`, `campaigns.setContent()`, and `campaigns.schedule()` as separate steps. Kit.com accepts all parameters in a single broadcast creation call.
- **No SDK**: Uses native `fetch` instead of `@mailchimp/mailchimp_marketing`
- **Tag-based filtering**: Uses `subscriber_filter` with tag ID instead of Mailchimp's segment conditions on interest groups
- **Simpler error handling**: Single try/catch instead of three

---

### 5.5 .github/workflows/scripts/kit/htmlContent.js

**Path**: `.github/workflows/scripts/kit/htmlContent.js`
**Replaces**: `.github/workflows/scripts/mailchimp/htmlContent.js`
**Runtime**: GitHub Actions (Node.js 20)

Generates the HTML email body content for TSC notification emails.

**Input**: `(link, title)` -- URL and title of the GitHub resource

**Key differences from old implementation**:
- **~500 lines reduced to ~5 lines**: Kit.com wraps the `content` in its own email template, so we only provide the body text. The old Mailchimp version included the full HTML document with MSO conditionals, inline styles, responsive CSS, and Mailchimp-specific markup.
- **Liquid syntax**: Uses `{{ subscriber.first_name }}` instead of `*|FNAME|*`
- **No unsubscribe/profile links**: Kit.com handles `unsubscribe` and `update preferences` links automatically in the email template footer. The old version manually included `*|UNSUB|*` and `*|UPDATE_PROFILE|*` merge tags.

---

### 5.6 .github/workflows/notify-tsc-members-mention.yml

**Path**: `.github/workflows/notify-tsc-members-mention.yml`
**Runtime**: GitHub Actions
**Note**: This file is centrally managed in `https://github.com/asyncapi/.github/`

**Changes made across all 6 jobs** (issue, pull_request, discussion, issue_comment, pr_comment, discussion_comment):

| Setting | Old Value | New Value |
|---|---|---|
| Node.js version | `16` | `20` |
| Working directory | `./.github/workflows/scripts/mailchimp` | `./.github/workflows/scripts/kit` |
| Step name | "Send email with MailChimp" | "Send email with Kit.com" |
| Section comment | "Handling Mailchimp notifications" | "Handling Kit.com email notifications" |
| Env: API key | `MAILCHIMP_API_KEY: ${{ secrets.MAILCHIMP_API_KEY }}` | `KIT_API_KEY: ${{ secrets.KIT_API_KEY }}` |
| Env: Tag ID | _(not needed, hardcoded in script)_ | `KIT_TAG_ID_TSC_VOTING: ${{ secrets.KIT_TAG_ID_TSC_VOTING }}` |
| Script path | `./.github/workflows/scripts/mailchimp/index.js` | `./.github/workflows/scripts/kit/index.js` |

Slack notification handling is completely unchanged.

---

## 6. Environment Variables

### 6.1 Netlify Environment Variables

Set these in the Netlify dashboard under **Site Settings > Environment Variables**.

| Variable | Description | Example |
|---|---|---|
| `KIT_API_KEY` | Kit.com V4 API Key. Created in [Developer Settings](https://app.kit.com/account_settings/developer_settings). | `kit_v4_abc123...` |

**Removed**: `MAILCHIMP_API_KEY`

### 6.2 GitHub Actions Secrets

Set these in the GitHub repository under **Settings > Secrets and variables > Actions**.

| Secret | Description | Example |
|---|---|---|
| `KIT_API_KEY` | Kit.com V4 API Key (same key as Netlify) | `kit_v4_abc123...` |
| `KIT_TAG_ID_TSC_VOTING` | Numeric ID of the "TSC Voting" tag in Kit.com | `12345` |

**Removed**: `MAILCHIMP_API_KEY`

**Unchanged**: `SLACK_TSC_MEMBERS_NOTIFY`, `CALENDAR_ID`, `CALENDAR_SERVICE_ACCOUNT`

---

## 7. Setup Guide

### 7.1 Kit.com Account Setup

1. Sign up or log in at [kit.com](https://kit.com)
2. Ensure your account plan supports API access (check [pricing](https://kit.com/pricing))
3. Navigate to [Developer Settings](https://app.kit.com/account_settings/developer_settings)
4. Create a new **V4 API Key**
5. **Save the key immediately** -- it cannot be retrieved after leaving the page

### 7.2 Create Tags in Kit.com

Create 3 tags that correspond to the subscription interest types. You can create tags via the Kit.com UI or via the API:

**Via API**:
```bash
# Create "Newsletter" tag
curl --request POST \
  --url https://api.kit.com/v4/tags \
  --header 'Content-Type: application/json' \
  --header 'X-Kit-Api-Key: <YOUR_API_KEY>' \
  --data '{ "name": "Newsletter" }'

# Create "Meetings" tag
curl --request POST \
  --url https://api.kit.com/v4/tags \
  --header 'Content-Type: application/json' \
  --header 'X-Kit-Api-Key: <YOUR_API_KEY>' \
  --data '{ "name": "Meetings" }'

# Create "TSC Voting" tag
curl --request POST \
  --url https://api.kit.com/v4/tags \
  --header 'Content-Type: application/json' \
  --header 'X-Kit-Api-Key: <YOUR_API_KEY>' \
  --data '{ "name": "TSC Voting" }'
```

Each response will include the tag `id`. Note these IDs for the next steps.

**List existing tags** (to verify or retrieve IDs):
```bash
curl --request GET \
  --url https://api.kit.com/v4/tags \
  --header 'X-Kit-Api-Key: <YOUR_API_KEY>'
```

### 7.3 Configure the Repository

Update `config/kit-config.json` with the actual tag IDs:

```json
{
  "tags": {
    "Newsletter": 111111,
    "Meetings": 222222,
    "TSC Voting": 333333
  }
}
```

Replace `111111`, `222222`, `333333` with the real numeric IDs returned when you created the tags.

### 7.4 Set Environment Variables

**Netlify**:
1. Go to Netlify dashboard > Site Settings > Environment Variables
2. Add `KIT_API_KEY` with your V4 API key value
3. Remove `MAILCHIMP_API_KEY` if it exists

**GitHub Actions**:
1. Go to GitHub repo > Settings > Secrets and variables > Actions
2. Add secret `KIT_API_KEY` with your V4 API key value
3. Add secret `KIT_TAG_ID_TSC_VOTING` with the numeric ID of the "TSC Voting" tag
4. Remove `MAILCHIMP_API_KEY` secret if it exists

### 7.5 Verify the Migration

**Test website subscription**:
1. Run the website locally (`npm run dev`)
2. Navigate to the newsletter page
3. Submit the form with a test email
4. Verify the subscriber appears in Kit.com dashboard under Subscribers
5. Verify the subscriber has the correct tag applied

**Test broadcast creation** (manual API call):
```bash
curl --request POST \
  --url https://api.kit.com/v4/broadcasts \
  --header 'Content-Type: application/json' \
  --header 'X-Kit-Api-Key: <YOUR_API_KEY>' \
  --data '{
    "subject": "Test Broadcast",
    "content": "<p>This is a test.</p>",
    "description": "Migration test",
    "public": false,
    "published_at": "2024-01-01T00:00:00Z",
    "send_at": null,
    "preview_text": "Test",
    "subscriber_filter": [
      { "all": [{ "type": "tag", "ids": [TSC_VOTING_TAG_ID] }], "any": null, "none": null }
    ]
  }'
```

Setting `send_at` to `null` creates a draft without sending, which is safe for testing.

---

## 8. Migration Changelog

### 8.1 Files Created

| File | Purpose |
|---|---|
| `config/kit-config.json` | Tag ID configuration for website subscriptions |
| `.github/workflows/scripts/kit/index.js` | Broadcast creation and scheduling script |
| `.github/workflows/scripts/kit/htmlContent.js` | TSC notification email body template |
| `.github/workflows/scripts/kit/package.json` | Node.js dependencies for the GitHub Actions script |
| `docs/newsletter-kit-migration.md` | This documentation file |

### 8.2 Files Modified

| File | Changes |
|---|---|
| `netlify/functions/newsletter_subscription.ts` | Complete rewrite from Mailchimp SDK to Kit.com REST API |
| `.github/workflows/notify-tsc-members-mention.yml` | Updated all 6 jobs: Node 16->20, mailchimp->kit paths, new env vars |
| `package.json` | Removed `@mailchimp/mailchimp_marketing` and `md5` dependencies |

### 8.3 Files Deleted

| File | Reason |
|---|---|
| `config/mailchimp-config.json` | Replaced by `config/kit-config.json` |
| `.github/workflows/scripts/mailchimp/index.js` | Replaced by `scripts/kit/index.js` |
| `.github/workflows/scripts/mailchimp/htmlContent.js` | Replaced by `scripts/kit/htmlContent.js` |
| `.github/workflows/scripts/mailchimp/package.json` | Replaced by `scripts/kit/package.json` |
| `.github/workflows/scripts/mailchimp/package-lock.json` | No longer needed |

### 8.4 Dependencies Removed

| Package | Version | Reason |
|---|---|---|
| `@mailchimp/mailchimp_marketing` | `^3.0.80` | Replaced by native `fetch` calls to Kit.com API |
| `md5` | `^2.3.0` | No longer needed; Kit.com uses email directly, not MD5 hashes |

---

## 9. Kit.com API Documentation Reference

The following Kit.com API documentation pages were explored and referenced during this migration:

| Documentation Page | URL | Relevance |
|---|---|---|
| API Overview | [developers.kit.com/api-reference/overview](https://developers.kit.com/api-reference/overview) | Entry point; V4 API introduction |
| API Authentication | [developers.kit.com/api-reference/authentication](https://developers.kit.com/api-reference/authentication) | API Key setup and `X-Kit-Api-Key` header usage |
| Create a Subscriber | [developers.kit.com/api-reference/subscribers/create-a-subscriber](https://developers.kit.com/api-reference/subscribers/create-a-subscriber) | Upsert subscriber endpoint (main subscription flow) |
| Tag a Subscriber by Email | [developers.kit.com/api-reference/tags/tag-a-subscriber-by-email-address](https://developers.kit.com/api-reference/tags/tag-a-subscriber-by-email-address) | Apply interest tags to subscribers |
| Create a Tag | [developers.kit.com/api-reference/tags/create-a-tag](https://developers.kit.com/api-reference/tags/create-a-tag) | For initial tag setup in Kit.com account |
| List Tags | [developers.kit.com/api-reference/tags/list-tags](https://developers.kit.com/api-reference/tags/list-tags) | Retrieve tag IDs for configuration |
| Create a Broadcast | [developers.kit.com/api-reference/broadcasts/create-a-broadcast](https://developers.kit.com/api-reference/broadcasts/create-a-broadcast) | Schedule email broadcasts for TSC notifications |
| Response Codes | [developers.kit.com/api-reference/response-codes](https://developers.kit.com/api-reference/response-codes) | Error handling reference |
| Pagination | [developers.kit.com/api-reference/pagination](https://developers.kit.com/api-reference/pagination) | Cursor-based pagination (for list endpoints) |
| Dates | [developers.kit.com/api-reference/dates](https://developers.kit.com/api-reference/dates) | ISO8601 date format requirements |
| Full Documentation Index | [developers.kit.com/llms.txt](https://developers.kit.com/llms.txt) | Complete index of all available API pages |
