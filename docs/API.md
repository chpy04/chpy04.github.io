# API

**This is a contract.** The handlers under `app/api/**` and the functions in
`lib/api-client.ts` must match it. A disagreement is a bug in one of them, to
be fixed deliberately and in the same commit.

Everything is JSON except `POST /api/feedback`, which is multipart.
Request bodies are validated by a zod schema in `lib/validation.ts`; a
failure is `400 { error: "<field>: <message>" }`.

## Who can call what

There is exactly one public surface, and it is not in this file: the page
itself. `app/page.tsx` renders on the server from `lib/queries/content.ts`,
so a reader is served a complete portfolio without making a single request
to anything below.

**Every endpoint here requires a session.** That includes the reads — they
exist for the admin layer, which needs the archived rows the public page
omits. `middleware.ts` guards `/api/*` (except `/api/auth`) but cannot say
_which_ user is calling; `requireUserId()` in each handler does that
(D-004).

The two exceptions are `POST /api/auth`, which mints the token, and
`GET /api/session`, which answers who the caller is.

## Errors

| status | meaning                                                                   |
| ------ | ------------------------------------------------------------------------- |
| `400`  | bad body, or a value the database's check constraints rejected            |
| `401`  | no resolvable session                                                     |
| `404`  | no such row — **or somebody else's row**, which must be indistinguishable |
| `502`  | GitHub refused a feedback report                                          |
| `503`  | a feedback report could not be stored anywhere                            |
| `500`  | anything else; logged server-side, generic body                           |

A 403 is never returned for content. It would confirm the id exists.

## Auth

### `POST /api/auth`

`password` mode only. `{ password }` → `{ token }`, or `401`.

### `GET /api/session`

```json
{
  "user": { "id": "…", "email": "…", "name": "…" },
  "mode": "dev" | "password" | "supabase",
  "isSiteOwner": true
}
```

`isSiteOwner` is the one the UI acts on. A signed-in account that does not
own the displayed portfolio gets no edit layer — rendering one would offer
edits that silently write to a different site.

`401` here is **not an error state**. The portfolio is public and an
anonymous reader is the normal case; it simply means there is no edit layer
to turn on.

## Content

### `GET /api/content`

The whole page in one payload, **including archived rows**:

```json
{
  "profile": { … },
  "socials": [ … ],
  "projects": [ … ],
  "timeline": [ … ]
}
```

One endpoint rather than four because its only caller is the admin layer
picking up what the server-rendered page left out, and four requests for
one screen is three too many.

## Profile

No POST and no id in the path — there is exactly one profile per user, and
`getProfile()` creates it on demand.

### `GET /api/profile` → `SiteProfile`

### `PATCH /api/profile`

Any subset of `name`, `metaDescription`, `taglineLead`, `taglineName`,
`taglineRole`, `taglineOrg`, `about`, `headshotPath`, `resumeImagePath`,
`resumePdfPath`. An empty body is a `400`: it almost always means a typo'd
key that would otherwise be silently ignored.

## Social links

| method  | path                | body                            | returns            |
| ------- | ------------------- | ------------------------------- | ------------------ |
| `GET`   | `/api/socials`      | —                               | `SocialLink[]`     |
| `POST`  | `/api/socials`      | `{ label, url }`                | `201` `SocialLink` |
| `PUT`   | `/api/socials`      | `{ ids: string[] }`             | `SocialLink[]`     |
| `PATCH` | `/api/socials/{id}` | `{ label?, url?, isArchived? }` | `SocialLink`       |

`PUT` reorders the whole list: position **is** the order, so the client
sends every id and never computes an index. An id belonging to another user,
or a duplicate, rejects the whole request with a `400` — a partial reorder
would leave two rows sharing a position.

## Projects

| method  | path                 | body                                                                            | returns                 |
| ------- | -------------------- | ------------------------------------------------------------------------------- | ----------------------- |
| `GET`   | `/api/projects`      | —                                                                               | `Project[]`             |
| `POST`  | `/api/projects`      | `{ title, subtitle?, imagePath?, externalUrl?, writeup? }`                      | `201` `Project`         |
| `PUT`   | `/api/projects`      | `{ ids: string[] }`                                                             | `Project[]`             |
| `GET`   | `/api/projects/{id}` | —                                                                               | `Project`               |
| `PATCH` | `/api/projects/{id}` | any of `title`, `subtitle`, `imagePath`, `externalUrl`, `writeup`, `isArchived` | `Project`               |
| `POST`  | `/api/projects/{id}` | `{ label }` — adds a category                                                   | `201` `ProjectCategory` |

`externalUrl` accepts `null`, which is not the same as omitting it: null
clears the link and turns the card back into a write-up button.

A `Project` carries its categories inline, ordered by `sort_order`, archived
ones included.

### `PATCH /api/project-categories/{id}`

`{ label?, isArchived? }` → `ProjectCategory`. Created under its project,
patched here — by then the client has its id and the parent adds nothing.

## Timeline

| method  | path                 | body                                                                             | returns                         |
| ------- | -------------------- | -------------------------------------------------------------------------------- | ------------------------------- |
| `GET`   | `/api/timeline`      | —                                                                                | `TimelineEntry[]`, oldest first |
| `POST`  | `/api/timeline`      | `{ organization, title, startsOn, kind, description?, endsOn?, thumbnailPath? }` | `201` `TimelineEntry`           |
| `PATCH` | `/api/timeline/{id}` | any of those, plus `isArchived`                                                  | `TimelineEntry`                 |

**No `PUT`.** The timeline's order is `starts_on`, a fact about the entry
rather than a position somebody chose, so moving one means editing its date.

`startsOn`/`endsOn` are `YYYY-MM-DD`. `endsOn` accepts `null` for "to the
present". On create, `endsOn` before `startsOn` is a `400` from the schema;
on patch it is a `400` from the database's check constraint, because only
the database sees both values.

## Archiving is not a DELETE

There are no DELETE endpoints. `PATCH { isArchived: true }` is the whole of
it (D-003), and every archived row stays readable so the owner can restore
it.

## Feedback

### `POST /api/feedback`

`multipart/form-data`: `kind` (`bug` | `feature`), `description`, `url`,
optional `viewport`, `userAgent`, `screenshot`.

```json
{
  "target": "github" | "local",
  "reference": "#42" | "feedback/2026-09-20-…md",
  "url": "https://github.com/…" | null,
  "screenshotUploaded": true
}
```

Multipart rather than JSON because a screenshot rides along and base64
would inflate it ~33% against the 4.5 MB request-body ceiling.

`404` means this deployment ships without the widget (`lib/feedback/
enabled.ts`) — the route is closed, not just the button hidden. With no
`GITHUB_TOKEN`/`GITHUB_REPO` configured the report is written to
`feedback/` rather than refused, which is what `target: "local"` reports.

## Adding an endpoint

Validation schema → query function → isolation-test case → handler →
`lib/api-client.ts` → update this file in the same commit. Then
`npm run verify`.
