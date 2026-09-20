import { parseJsonBody, withApiErrors } from '@/lib/http';
import { createProject, listProjects, reorderProjects } from '@/lib/queries/projects';
import { requireUserId } from '@/lib/session';
import { createProjectSchema, reorderSchema } from '@/lib/validation';

export async function GET(request: Request): Promise<Response> {
  return withApiErrors(async () => {
    const userId = await requireUserId(request);
    return Response.json(await listProjects(userId));
  });
}

export async function POST(request: Request): Promise<Response> {
  return withApiErrors(async () => {
    const userId = await requireUserId(request);
    const body = await parseJsonBody(request, createProjectSchema);
    return Response.json(await createProject(userId, body), { status: 201 });
  });
}

/** Reorder the whole grid — see the socials route for why this is a PUT. */
export async function PUT(request: Request): Promise<Response> {
  return withApiErrors(async () => {
    const userId = await requireUserId(request);
    const { ids } = await parseJsonBody(request, reorderSchema);
    return Response.json(await reorderProjects(userId, ids));
  });
}
