---
paths:
  - 'components/**'
  - 'app/**/*.tsx'
---

# React components

## File shape

One component per file, `export default function Name(props: NameProps)`,
named to match the file. Props are a local `interface NameProps` above the
component with a doc comment on anything non-obvious.

Any file with state, effects, event handlers or hooks starts with
`'use client'`.

## Container and presentation

One container owns the data, the admin state and **every network call**;
the components under it are presentational and take callbacks.

Here the container is `components/SiteProvider.tsx`, and it is a context
rather than props because the alternative is threading a save callback five
levels down to reach a timeline card's job title. Nothing under it fetches:
`ProjectCard` and `TimelineCard` call `saveProject`/`saveTimelineEntry`
from `useSite()` and know nothing about URLs.

If you are adding a mutation, it goes on the provider — not in the
component that triggers it.

## Never call `fetch`

Every request goes through `lib/api-client.ts`, which is the only module
that knows URL shapes, and which routes through `authedFetch` for the token
and the 401 → logout path. Adding an endpoint means adding a function
there, not a `fetch` in a component. ESLint blocks bare `fetch` here.

`lib/api-client.ts` throws `ApiError` (carrying `status` and the server's
`{ error }` message) on any non-2xx. Catch it and show the message; do not
let it reach the user as a blank screen:

```tsx
catch (err) {
  setError(err instanceof ApiError ? err.message : 'Could not reach the server.');
}
```

## No server-side data access

`components/**` and `app/**` may not import `lib/db`, `drizzle-orm` or
`postgres` (ESLint enforced). Data arrives over the API.

## The page is public; only the edit layer is gated

There is no `AuthGate` here and nothing is hidden behind a login. A
component renders the same content for everyone; what changes is whether
`useSite().editing` is true.

`SiteProvider` asks the server `GET /api/session` rather than treating a
stored token as proof — in `dev` mode there is no token, and only the
server knows which mode is running. A 401 is the ordinary case, not an
error: it means a reader, so no edit affordances.

A reader's DOM should carry no trace of the admin layer — no handlers, no
extra classes, no placeholders. `EditableText` returns a plain element when
`editing` is false, and that is the shape to copy.

The feedback widget needs both a session _and_ a deployment that ships it,
which is why `FeedbackMount` checks two things (D-019).

## Keep logic out of components

Pure, testable logic lives in a module under `lib/` and is unit-tested
there; components wire it up and render. If you are about to write a
non-trivial `useMemo`, check whether it belongs in `lib/` with a test
instead. `lib/feedback/drag.ts` is the pattern: the interesting cases were
all data shape, and they are far cheaper to pin down in a unit test than in
a browser one.

## Archived content must stay reachable

The query layer returns archived rows and lets the UI decide (D-003). The
UI's job is to hide them **without stranding them** — a user must never end
up with a row they can no longer find in order to restore it. The admin
toolbar's "Show archived" switch is that, and `e2e/portfolio.spec.ts`
asserts the archive-then-restore round trip.
