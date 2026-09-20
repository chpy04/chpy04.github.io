/**
 * `POST /api/feedback` — turns an in-app report into a GitHub issue, or
 * into a markdown file under `feedback/` when no repo is configured.
 *
 * `multipart/form-data`, not JSON, because a screenshot rides along; sending
 * the image base64-in-JSON would inflate it ~33% against Vercel's 4.5 MB
 * request-body ceiling for no benefit.
 *
 * Two gates, and both are needed. `isFeedbackEnabled()` decides whether this
 * endpoint exists on this deployment at all — hiding the button without
 * closing the route would leave an open relay behind it. Then it resolves a
 * caller like every other handler, because `middleware.ts` waves every
 * request through in `dev` auth mode and cannot be what stops that.
 */

import { errorResponse, withApiErrors } from '@/lib/http';
import { BadRequestError } from '@/lib/queries/errors';
import { isFeedbackEnabled } from '@/lib/feedback/enabled';
import { FeedbackConfigError, GitHubApiError } from '@/lib/feedback/github';
import { ALLOWED_SCREENSHOT_TYPES, extensionForMimeType } from '@/lib/feedback/issue';
import { fileFeedback, type ScreenshotUpload } from '@/lib/feedback/submit';
import { requireUserId } from '@/lib/session';
import { feedbackSchema } from '@/lib/validation';

/** Comfortably under Vercel's 4.5 MB body limit; the widget downscales
 *  anything larger before it ever gets here. */
const MAX_SCREENSHOT_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  // 404, not 403: on a deployment without the widget this endpoint genuinely
  // is not part of the app, and saying so leaks nothing about what is.
  if (!isFeedbackEnabled()) return errorResponse('not found', 404);

  try {
    return await withApiErrors(async () => {
      await requireUserId(request);

      const form = await readFormData(request);

      const parsed = feedbackSchema.safeParse({
        kind: stringField(form, 'kind'),
        description: stringField(form, 'description'),
        url: stringField(form, 'url'),
        viewport: stringField(form, 'viewport'),
        userAgent: stringField(form, 'userAgent'),
      });
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const path = issue?.path?.length ? `${issue.path.join('.')}: ` : '';
        throw new BadRequestError(`${path}${issue?.message ?? 'invalid feedback'}`);
      }

      const result = await fileFeedback({
        ...parsed.data,
        screenshot: await readScreenshot(form),
      });

      return Response.json(result, { status: 201 });
    });
  } catch (err) {
    // Neither of these is the caller's fault, so they don't belong in
    // `withApiErrors`' 400/404 vocabulary.
    //
    // `FeedbackConfigError` reaching here means the *local* sink also failed
    // (a read-only working directory, say) — `fileFeedback` swallows the
    // unconfigured case by writing a file instead.
    if (err instanceof FeedbackConfigError) {
      console.error('[feedback]', err.message);
      return errorResponse('feedback is not configured on this deployment', 503);
    }
    if (err instanceof GitHubApiError) {
      console.error('[feedback]', err.message);
      return errorResponse(`GitHub rejected the issue: ${err.message}`, 502);
    }
    throw err;
  }
}

async function readFormData(request: Request): Promise<FormData> {
  try {
    return await request.formData();
  } catch {
    throw new BadRequestError('expected a multipart/form-data body');
  }
}

function stringField(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return value;
}

async function readScreenshot(form: FormData): Promise<ScreenshotUpload | null> {
  const file = form.get('screenshot');
  if (!file || typeof file === 'string') return null;

  if (!extensionForMimeType(file.type)) {
    throw new BadRequestError(`screenshot must be one of ${ALLOWED_SCREENSHOT_TYPES.join(', ')}`);
  }
  if (file.size === 0) return null;
  if (file.size > MAX_SCREENSHOT_BYTES) {
    throw new BadRequestError(
      `screenshot is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is ${MAX_SCREENSHOT_BYTES / 1024 / 1024} MB`,
    );
  }

  return { bytes: new Uint8Array(await file.arrayBuffer()), mimeType: file.type };
}
