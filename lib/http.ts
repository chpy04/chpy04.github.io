/**
 * Small shared plumbing so route handlers stay thin: parse+validate a JSON
 * body against a zod schema, and map query-layer errors to the right HTTP
 * status without ever leaking a raw stack trace (docs/API.md, "Errors").
 */
import type { ZodType } from 'zod';
import { BadRequestError, NotFoundError, UnauthorizedError } from './queries/errors.ts';

/**
 * Second argument Next hands every dynamic App Router handler. Declared once
 * here because `next build` type-checks handler signatures against its own
 * generated types, so the shape is not ours to vary per route.
 */
export interface RouteContext {
  params: Promise<{ id: string }>;
}

export function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

/** Thrown by `parseJsonBody` on invalid JSON or a failed schema check;
 * callers don't need to catch this directly — `withApiErrors` does. */
export async function parseJsonBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new BadRequestError('invalid JSON body');
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path?.length ? `${issue.path.join('.')}: ` : '';
    throw new BadRequestError(`${path}${issue?.message ?? 'invalid request body'}`);
  }
  return result.data;
}

/** Postgres `check_violation`. A check constraint only ever fires on a
 *  value the caller supplied, so it is a 400 — but it arrives as a driver
 *  error rather than one of ours, because the two columns it compares are
 *  only both visible inside the database (see `patchTimelineSchema`). */
const PG_CHECK_VIOLATION = '23514';

function checkConstraintName(err: unknown): string | null {
  if (typeof err !== 'object' || err === null) return null;
  const candidate = err as { code?: unknown; constraint_name?: unknown };
  if (candidate.code !== PG_CHECK_VIOLATION) return null;
  return typeof candidate.constraint_name === 'string' ? candidate.constraint_name : 'unknown';
}

/**
 * Wraps a route handler body: `UnauthorizedError` -> 401, `BadRequestError`
 * -> 400, `NotFoundError` -> 404, a database check violation -> 400, and
 * anything else -> 500 with a generic message (logged server-side, never
 * returned to the client).
 */
export async function withApiErrors(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (err) {
    if (err instanceof UnauthorizedError) return errorResponse(err.message, 401);
    if (err instanceof BadRequestError) return errorResponse(err.message, 400);
    if (err instanceof NotFoundError) return errorResponse(err.message, 404);

    const constraint = checkConstraintName(err);
    if (constraint) {
      console.error(err);
      return errorResponse(`the database rejected that value (${constraint})`, 400);
    }

    console.error(err);
    return errorResponse('internal server error', 500);
  }
}
