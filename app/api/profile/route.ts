/**
 * The page's singular fields. No POST and no id in the path: there is
 * exactly one profile per user and `getProfile` creates it on demand, so
 * "which one" is never a question a caller has to answer.
 */
import { parseJsonBody, withApiErrors } from '@/lib/http';
import { getProfile, updateProfile } from '@/lib/queries/profile';
import { requireUserId } from '@/lib/session';
import { patchProfileSchema } from '@/lib/validation';

export async function GET(request: Request): Promise<Response> {
  return withApiErrors(async () => {
    const userId = await requireUserId(request);
    return Response.json(await getProfile(userId));
  });
}

export async function PATCH(request: Request): Promise<Response> {
  return withApiErrors(async () => {
    const userId = await requireUserId(request);
    const body = await parseJsonBody(request, patchProfileSchema);
    return Response.json(await updateProfile(userId, body));
  });
}
