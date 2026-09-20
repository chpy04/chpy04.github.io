/**
 * A category chip, addressed on its own. Created under its project
 * (`POST /api/projects/{id}`) but patched here, because by then the client
 * has its id and the parent adds nothing to the URL.
 */
import { parseJsonBody, type RouteContext, withApiErrors } from '@/lib/http';
import { updateProjectCategory } from '@/lib/queries/projects';
import { requireUserId } from '@/lib/session';
import { patchProjectCategorySchema } from '@/lib/validation';

export async function PATCH(request: Request, { params }: RouteContext): Promise<Response> {
  return withApiErrors(async () => {
    const userId = await requireUserId(request);
    const { id } = await params;
    const body = await parseJsonBody(request, patchProjectCategorySchema);
    return Response.json(await updateProjectCategory(userId, id, body));
  });
}
