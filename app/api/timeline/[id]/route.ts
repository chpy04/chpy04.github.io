import { parseJsonBody, type RouteContext, withApiErrors } from '@/lib/http';
import { updateTimelineEntry } from '@/lib/queries/timeline';
import { requireUserId } from '@/lib/session';
import { patchTimelineSchema } from '@/lib/validation';

export async function PATCH(request: Request, { params }: RouteContext): Promise<Response> {
  return withApiErrors(async () => {
    const userId = await requireUserId(request);
    const { id } = await params;
    const body = await parseJsonBody(request, patchTimelineSchema);
    return Response.json(await updateTimelineEntry(userId, id, body));
  });
}
