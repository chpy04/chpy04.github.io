---
paths: 'app/api/**'
---

# Route handlers

`docs/API.md` is the contract, not a description. Code and doc disagreeing is
a bug in one of them; fix it deliberately and in the same commit.

## The three-layer split

A handler does four things and no more: resolve the caller, parse the body,
call one query function, shape the response. Anything else belongs a layer
down.

1. **Validation** — a zod schema in `lib/validation.ts`.
2. **Data access** — a function in `lib/queries/<resource>.ts`. This is the
   only layer allowed to import `lib/db` (ESLint enforces it).
3. **Handler** — `app/api/<resource>/route.ts`, wrapped in `withApiErrors`.

```ts
import { parseJsonBody, type RouteContext, withApiErrors } from '@/lib/http';

export async function PATCH(request: Request, { params }: RouteContext): Promise<Response> {
  return withApiErrors(async () => {
    const userId = await requireUserId(request);
    const { id } = await params;
    const body = await parseJsonBody(request, patchProjectSchema);
    return Response.json(await updateProject(userId, id, body));
  });
}
```

- `RouteContext` is imported from `lib/http.ts` — never redeclared locally.
  `next build` type-checks handler signatures against Next's own generated
  types, so the shape is not ours to vary.
- Never `try/catch` for HTTP status. Throw `NotFoundError` / `BadRequestError`
  from `lib/queries/errors.ts`; `withApiErrors` maps them to 404 / 400 and
  everything else to a logged 500 with a generic body.
- `201` on create, `204` with a null body on delete, `200` otherwise.
- Unused handler parameters take a `_` prefix (`_request`).

## Every handler resolves a caller

```ts
const userId = await requireUserId(request); // lib/session.ts
```

First line of the handler body, then thread `userId` into the query
function, which filters on it. `middleware.ts` guards `/api/*` (except
`/api/auth`) but **cannot** say _which_ user is calling — it runs on the
Edge runtime and has no database — so it is not what keeps accounts apart.
Your `WHERE` clause is (D-004).

`requireUserId` throws `UnauthorizedError` (-> 401) for every auth mode when
it cannot resolve a session, so there is no token check to write by hand.
Another user's id must come back as `NotFoundError`, never a 403: a 403
confirms the id exists. See `.claude/rules/auth.md` for the three modes and
`lib/queries/isolation.test.ts` for the executable version of this rule.

The exceptions are `POST /api/auth` (there is no caller yet — it mints the
token) and `GET /api/session` (it answers _who_ the caller is).
`POST /api/feedback` is **not** an exception: it resolves a caller even
though it writes nothing user-scoped, because that is what stops it being an
open issue-filing relay.

## Archiving is not a DELETE

There are no DELETE endpoints for content — only `isArchived` on a PATCH
(D-003). If you are about to add one, that is the decision to raise, not to
make.

## Adding an endpoint

Validation schema → query function → isolation-test case → handler →
`lib/api-client.ts` → update `docs/API.md` in the same commit. Then
`npm run verify`.
