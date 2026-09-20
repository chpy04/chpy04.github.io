/**
 * No PUT here, unlike socials and projects: the timeline's order is
 * `starts_on`, which is a fact about the entry rather than a position
 * somebody chose. Moving an entry means editing its date.
 */
import { parseJsonBody, withApiErrors } from '@/lib/http';
import { createTimelineEntry, listTimeline } from '@/lib/queries/timeline';
import { requireUserId } from '@/lib/session';
import { createTimelineSchema } from '@/lib/validation';

export async function GET(request: Request): Promise<Response> {
  return withApiErrors(async () => {
    const userId = await requireUserId(request);
    return Response.json(await listTimeline(userId));
  });
}

export async function POST(request: Request): Promise<Response> {
  return withApiErrors(async () => {
    const userId = await requireUserId(request);
    const body = await parseJsonBody(request, createTimelineSchema);
    return Response.json(await createTimelineEntry(userId, body), { status: 201 });
  });
}
