import { parseJsonBody, type RouteContext, withApiErrors } from '@/lib/http';
import { createProjectCategory, getProject, updateProject } from '@/lib/queries/projects';
import { requireUserId } from '@/lib/session';
import { createProjectCategorySchema, patchProjectSchema } from '@/lib/validation';

export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
  return withApiErrors(async () => {
    const userId = await requireUserId(request);
    const { id } = await params;
    return Response.json(await getProject(userId, id));
  });
}

export async function PATCH(request: Request, { params }: RouteContext): Promise<Response> {
  return withApiErrors(async () => {
    const userId = await requireUserId(request);
    const { id } = await params;
    const body = await parseJsonBody(request, patchProjectSchema);
    return Response.json(await updateProject(userId, id, body));
  });
}

/** A category chip under this project. Child rows hang off their parent's
 *  URL; the query layer re-checks that the parent is the caller's before
 *  writing. */
export async function POST(request: Request, { params }: RouteContext): Promise<Response> {
  return withApiErrors(async () => {
    const userId = await requireUserId(request);
    const { id } = await params;
    const { label } = await parseJsonBody(request, createProjectCategorySchema);
    return Response.json(await createProjectCategory(userId, id, label), { status: 201 });
  });
}
