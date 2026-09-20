/**
 * The only module that talks to Supabase Storage. Two jobs: mint a signed
 * URL the browser can PUT one file to, and (for the migration script) push
 * bytes up from Node.
 *
 * Plain `fetch` against the Storage REST API rather than
 * `@supabase/supabase-js`: the whole surface used here is three URLs, and a
 * dependency that pulls in an auth client, a realtime client and a postgrest
 * client to do it would be the largest thing in `package.json` (D-008).
 *
 * **The service-role key never leaves the server.** It signs the upload URL;
 * the browser gets a token scoped to one object key with an expiry, and
 * nothing else.
 */

import { publicMediaUrl } from './media.ts';

const SIGN_TIMEOUT_MS = 15_000;
/** Generous, unlike the signing timeout: this one carries the bytes, and the
 *  files being migrated run to 18 MB. */
const UPLOAD_TIMEOUT_MS = 120_000;
const DEFAULT_BUCKET = 'portfolio-media';

/** Just the slots this module reads — narrower than `NodeJS.ProcessEnv` so a
 *  test can pass a literal. */
export type StorageEnv = Record<string, string | undefined>;

export interface StorageConfig {
  /** Project URL, no trailing slash: `https://<ref>.supabase.co`. */
  url: string;
  serviceKey: string;
  bucket: string;
}

/** Missing/malformed env. Maps to 503 — this deployment has no storage
 *  wired up, which is a deployment fact rather than a caller mistake. */
export class StorageConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageConfigError';
  }
}

/** Supabase said no. Maps to 502 — the app is fine, the upstream call isn't. */
export class StorageApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'StorageApiError';
    this.status = status;
  }
}

/**
 * Reads `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and the optional
 * `SUPABASE_STORAGE_BUCKET`. Fails closed and loudly: an unset key must
 * never degrade into uploads that appear to work.
 */
export function readStorageConfig(env: StorageEnv = process.env): StorageConfig {
  const url = env.SUPABASE_URL?.trim().replace(/\/+$/, '');
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url) {
    throw new StorageConfigError('SUPABASE_URL is not set — uploads have nowhere to go.');
  }
  if (!/^https?:\/\//.test(url)) {
    throw new StorageConfigError(`SUPABASE_URL must be a URL, got "${url}".`);
  }
  if (!serviceKey) {
    throw new StorageConfigError(
      'SUPABASE_SERVICE_ROLE_KEY is not set — uploads cannot be signed.',
    );
  }

  return { url, serviceKey, bucket: env.SUPABASE_STORAGE_BUCKET?.trim() || DEFAULT_BUCKET };
}

async function storageFetch(
  cfg: StorageConfig,
  path: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${cfg.url}/storage/v1${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${cfg.serviceKey}`,
        apikey: cfg.serviceKey,
        ...init.headers,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new StorageApiError(504, `could not reach Supabase Storage: ${reason}`);
  }

  if (!response.ok) {
    throw new StorageApiError(response.status, await describeFailure(response, path));
  }
  return response;
}

async function describeFailure(response: Response, path: string): Promise<string> {
  let detail = '';
  try {
    const body = (await response.json()) as { message?: string; error?: string };
    detail = body.message ?? body.error ?? '';
  } catch {
    // Non-JSON error body; the status alone will have to do.
  }
  return `Supabase Storage ${response.status} on ${path}${detail ? `: ${detail}` : ''}`;
}

export interface SignedUpload {
  /** Absolute, single-use, carries its own token — PUT the file here. */
  uploadUrl: string;
  /** Where the file will be readable once the PUT lands. */
  publicUrl: string;
  /** The object key inside the bucket. */
  path: string;
}

/**
 * Signs an upload of exactly `key`, for the default expiry (two hours).
 *
 * The browser cannot choose the key: it is built server-side from the
 * caller's own user id, so a signed URL is only ever permission to write one
 * object in one place.
 */
export async function createSignedUploadUrl(
  cfg: StorageConfig,
  key: string,
): Promise<SignedUpload> {
  const response = await storageFetch(
    cfg,
    `/object/upload/sign/${cfg.bucket}/${key}`,
    { method: 'POST' },
    SIGN_TIMEOUT_MS,
  );

  // `{ url: "/object/upload/sign/<bucket>/<key>?token=..." }` — relative to
  // the storage root, which is why it is joined back on here.
  const body = (await response.json()) as { url?: string };
  if (!body.url) {
    throw new StorageApiError(502, 'Supabase Storage returned no signed URL');
  }

  return {
    uploadUrl: `${cfg.url}/storage/v1${body.url}`,
    publicUrl: publicMediaUrl(cfg.url, cfg.bucket, key),
    path: key,
  };
}

/**
 * Uploads bytes from the server. Not the path the edit layer takes — that
 * one signs a URL and has the browser PUT it — but the one the migration
 * script needs, and the only way to write an object without a session.
 *
 * Overwrites, so re-running the migration is idempotent rather than
 * duplicating 50 MB under new names.
 */
export async function uploadObject(
  cfg: StorageConfig,
  key: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  await storageFetch(
    cfg,
    `/object/${cfg.bucket}/${key}`,
    {
      method: 'POST',
      headers: { 'content-type': contentType, 'x-upsert': 'true' },
      body: bytes as unknown as BodyInit,
    },
    UPLOAD_TIMEOUT_MS,
  );

  return publicMediaUrl(cfg.url, cfg.bucket, key);
}
