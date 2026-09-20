/**
 * Note what is absent: a DELETE. Content is archived, never deleted —
 * `PATCH { isArchived: true }` is the whole of it. See
 * `.claude/rules/data-access.md`.
 */
import { parseJsonBody, type RouteContext, withApiErrors } from '@/lib/http';
import { updateSocial } from '@/lib/queries/socials';
import { requireUserId } from '@/lib/session';
import { patchSocialSchema } from '@/lib/validation';

export async function PATCH(request: Request, { params }: RouteContext): Promise<Response> {
  return withApiErrors(async () => {
    const userId = await requireUserId(request);
    const { id } = await params;
    const body = await parseJsonBody(request, patchSocialSchema);
    return Response.json(await updateSocial(userId, id, body));
  });
}
