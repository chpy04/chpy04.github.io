import { parseJsonBody, withApiErrors } from '@/lib/http';
import { createSocial, listSocials, reorderSocials } from '@/lib/queries/socials';
import { requireUserId } from '@/lib/session';
import { createSocialSchema, reorderSchema } from '@/lib/validation';

export async function GET(request: Request): Promise<Response> {
  return withApiErrors(async () => {
    const userId = await requireUserId(request);
    return Response.json(await listSocials(userId));
  });
}

export async function POST(request: Request): Promise<Response> {
  return withApiErrors(async () => {
    const userId = await requireUserId(request);
    const body = await parseJsonBody(request, createSocialSchema);
    return Response.json(await createSocial(userId, body), { status: 201 });
  });
}

/**
 * Reorder the whole list. A PUT rather than a PATCH per row: order is a
 * property of the list, and sending it one row at a time makes every
 * intermediate state a lie.
 */
export async function PUT(request: Request): Promise<Response> {
  return withApiErrors(async () => {
    const userId = await requireUserId(request);
    const { ids } = await parseJsonBody(request, reorderSchema);
    return Response.json(await reorderSocials(userId, ids));
  });
}
