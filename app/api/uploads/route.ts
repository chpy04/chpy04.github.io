/**
 * `POST /api/uploads` — signs one upload into the media bucket.
 *
 * It does not carry the file. The handler names the object, asks Supabase
 * for a URL that may be written exactly once at exactly that name, and hands
 * the browser back the signed URL plus the public URL the file will live at
 * (D-027). The bytes go browser → Supabase; the app never sees them, which
 * is what lets an 18 MB GIF through a host that caps request bodies at
 * 4.5 MB.
 *
 * The key is built from `requireUserId`'s answer, never from anything the
 * caller sent, so a signature is only ever permission to write inside the
 * caller's own prefix.
 *
 * There is no DELETE. Replacing an image leaves the old object in the
 * bucket, the same way archiving leaves a row (D-003): something else may
 * still point at it, and storage is cheap next to a broken image.
 */

import { errorResponse, parseJsonBody, withApiErrors } from '@/lib/http';
import { requireUserId } from '@/lib/session';
import { mediaObjectKey } from '@/lib/storage/media';
import {
  createSignedUploadUrl,
  readStorageConfig,
  StorageApiError,
  StorageConfigError,
} from '@/lib/storage/supabase';
import { createUploadSchema } from '@/lib/validation';

export async function POST(request: Request): Promise<Response> {
  try {
    return await withApiErrors(async () => {
      const userId = await requireUserId(request);
      const { filename, contentType } = await parseJsonBody(request, createUploadSchema);

      const config = readStorageConfig();
      const key = mediaObjectKey({
        userId,
        filename,
        mimeType: contentType,
        at: new Date(),
        // Web Crypto's, not node:crypto's — same value, one less import.
        id: crypto.randomUUID(),
      });

      return Response.json(await createSignedUploadUrl(config, key), { status: 201 });
    });
  } catch (err) {
    // Neither of these is the caller's fault, so they don't belong in
    // `withApiErrors`' 400/404 vocabulary — same split as the feedback route.
    if (err instanceof StorageConfigError) {
      console.error('[uploads]', err.message);
      return errorResponse('file storage is not configured on this deployment', 503);
    }
    if (err instanceof StorageApiError) {
      console.error('[uploads]', err.message);
      return errorResponse(`storage refused the upload: ${err.message}`, 502);
    }
    throw err;
  }
}
