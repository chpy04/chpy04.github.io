import { getAuthMode } from '@/lib/auth-mode';
import { withApiErrors } from '@/lib/http';
import { requireUser } from '@/lib/session';
import { isSiteOwner } from '@/lib/site-owner';
import type { SessionInfo } from '@/lib/types';

/**
 * Who am I? The browser calls this on load instead of assuming a stored
 * token means "logged in": in `dev` mode there is no token at all, and the
 * answer is whichever user the seed created.
 *
 * `401` here is not an error state for this app — the portfolio is public,
 * and an anonymous reader is the normal case. It is simply the signal that
 * there is no edit layer to turn on.
 */
export async function GET(request: Request): Promise<Response> {
  return withApiErrors(async () => {
    const user = await requireUser(request);
    const body: SessionInfo = {
      user,
      mode: getAuthMode(),
      isSiteOwner: await isSiteOwner(user.id),
    };
    return Response.json(body);
  });
}
