/**
 * The rules for what may be uploaded, what it is called in the bucket, and
 * where it can be read back from. No network, no env, no `File` — plain
 * functions over plain data, so `media.test.ts` covers them without
 * Supabase credentials and the browser can apply the same rules before it
 * bothers the server.
 *
 * The bucket mirrors this list (`allowed_mime_types` on `storage.buckets`)
 * and its 50 MB `file_size_limit`. Two places enforcing the same rule is
 * deliberate: the bucket is the one a forged request also hits.
 */

/**
 * Extension by mime type — and, being the only list of both, the allowlist.
 *
 * No `image/svg+xml`. An SVG is a script host, and the bucket is served
 * from a domain of its own with permissive CORS; `next/image` also refuses
 * to optimize one without `dangerouslyAllowSVG`. A portfolio has no need
 * for a vector it cannot render, so the whole class stays out.
 */
const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'application/pdf': 'pdf',
};

export const ALLOWED_UPLOAD_TYPES: readonly string[] = Object.keys(EXTENSION_BY_MIME);

/** What a document field takes — today, the resume. */
export const ALLOWED_DOCUMENT_TYPES: readonly string[] = ['application/pdf'];

/** Everything but the documents — what an image field will take. */
export const ALLOWED_IMAGE_TYPES: readonly string[] = ALLOWED_UPLOAD_TYPES.filter(
  (type) => !ALLOWED_DOCUMENT_TYPES.includes(type),
);

/**
 * 50 MB, matching the bucket. Generous for a still, but the site's own
 * animated GIFs run to 18 MB and refusing to re-upload content that is
 * already on the page would be a strange limit to ship.
 *
 * It is only reachable because the bytes never pass through the app: the
 * browser PUTs them straight to Supabase against a signed URL (D-027).
 * A proxying endpoint would cap out at the host's 4.5 MB request body.
 */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** `null` for anything not in the allowlist. */
export function extensionForMimeType(mimeType: string): string | null {
  return EXTENSION_BY_MIME[mimeType.toLowerCase().split(';')[0]!.trim()] ?? null;
}

/**
 * The reverse lookup, for a file on disk rather than an upload: `.JPEG`,
 * `jpeg` and `jpg` are all `image/jpeg`. `null` for anything not allowed,
 * which is how the migration script skips a `.DS_Store`.
 */
export function mimeTypeForExtension(extension: string): string | null {
  const wanted = extension.toLowerCase().replace(/^\./, '');
  const normalized = wanted === 'jpeg' ? 'jpg' : wanted;
  return ALLOWED_UPLOAD_TYPES.find((type) => EXTENSION_BY_MIME[type] === normalized) ?? null;
}

/** `image/png, image/jpeg, …` — the `accept` attribute of a file input. */
export function acceptAttribute(types: readonly string[]): string {
  return types.join(',');
}

const SLUG_MAX = 40;

/**
 * The readable half of an object key: `Ski Racing (final).PNG` ->
 * `ski-racing-final`. Kept because a bucket listing of nothing but
 * timestamps is unreadable, and dropped entirely when a name survives as
 * nothing — a key ending in `-.png` reads like a bug.
 */
export function slugifyFilename(filename: string): string {
  return filename
    .replace(/\.[^.]*$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/, '');
}

export interface ObjectKeyInput {
  /** Whose upload this is. Uploads are namespaced by owner even though the
   *  bucket has no notion of one, so a second account can never overwrite
   *  the first account's file by uploading the same name. */
  userId: string;
  filename: string;
  mimeType: string;
  at: Date;
  /** Random per upload — a uuid at the call site. */
  id: string;
}

/**
 * `u/<userId>/2026/09/2026-09-20T15-04-05-123Z-a1b2c3d4-headshot.jpg`.
 *
 * Date-partitioned so the bucket stays browsable, and suffixed with a random
 * id so two uploads in the same millisecond cannot collide — a collision
 * would silently replace an image some other row still points at.
 *
 * Throws on a type outside the allowlist rather than inventing an
 * extension: the extension is what the CDN serves the content type from.
 */
export function mediaObjectKey({ userId, filename, mimeType, at, id }: ObjectKeyInput): string {
  const extension = extensionForMimeType(mimeType);
  if (!extension) throw new Error(`unsupported upload type: ${mimeType}`);

  const iso = at.toISOString();
  const slug = slugifyFilename(filename);
  const stamp = `${iso.replace(/[:.]/g, '-')}-${id.replace(/-/g, '').slice(0, 8)}`;

  return `u/${userId}/${iso.slice(0, 4)}/${iso.slice(5, 7)}/${stamp}${slug ? `-${slug}` : ''}.${extension}`;
}

/** Where a public bucket's object is readable from. Stored in the database
 *  as-is, which is what keeps every component a plain `<Image src=…>`. */
export function publicMediaUrl(supabaseUrl: string, bucket: string, key: string): string {
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/${key}`;
}

/**
 * The same URL, but as a download rather than something the browser opens.
 *
 * The `download` attribute on an `<a>` is ignored cross-origin, and every
 * media URL is now cross-origin — so the resume button would have opened the
 * PDF in a tab instead. Supabase Storage answers `?download` with
 * `Content-Disposition: attachment`, which is honoured wherever it is served
 * from. Anything that is not a storage URL is returned untouched.
 */
export function downloadUrl(url: string): string {
  if (!url.includes('/storage/v1/object/public/')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}download`;
}

// ---------------------------------------------------------------------------
// Picking a file out of a drop
// ---------------------------------------------------------------------------

/** The parts of a `File` any of this cares about. Plain data so the drop
 *  logic is testable without a DOM. */
export interface DroppedFile {
  name: string;
  type: string;
  size: number;
}

export interface FileChoice<T extends DroppedFile> {
  file: T | null;
  /** Why nothing was taken, phrased for the owner to read. */
  error: string | null;
}

/**
 * The first file in a drop that this field will take, or the reason none of
 * them was taken.
 *
 * Dropping several files is treated as dropping the first one rather than as
 * an error: one field holds one image, and refusing a two-file drop outright
 * is more annoying than useful. Dropping a `.mov` is a real mistake and says
 * so, here rather than after a round trip.
 */
export function chooseUpload<T extends DroppedFile>(
  files: readonly T[],
  accept: readonly string[],
): FileChoice<T> {
  if (files.length === 0) {
    return { file: null, error: 'That drop had no file in it.' };
  }

  const file = files.find((candidate) => accept.includes(candidate.type.toLowerCase()));
  if (!file) {
    const names = accept.map((type) => extensionForMimeType(type) ?? type).join(', ');
    return { file: null, error: `That file is not one of: ${names}.` };
  }

  if (file.size === 0) {
    return { file: null, error: `${file.name} is empty.` };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return {
      file: null,
      error: `${file.name} is ${mb} MB; the limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
    };
  }

  return { file, error: null };
}
