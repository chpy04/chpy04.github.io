import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  StorageApiError,
  StorageConfigError,
  createSignedUploadUrl,
  readStorageConfig,
  uploadObject,
  type StorageConfig,
} from './supabase.ts';

const CONFIG: StorageConfig = {
  url: 'https://ref.supabase.co',
  serviceKey: 'service-key',
  bucket: 'portfolio-media',
};

const ENV = {
  SUPABASE_URL: 'https://ref.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
};

interface Call {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
}

/** Installs a `fetch` that replies from `reply`, recording every call.
 *  Returns the recording plus a restore function. */
function stubFetch(reply: (call: Call) => { status: number; body: unknown }): {
  calls: Call[];
  restore: () => void;
} {
  const calls: Call[] = [];
  const original = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const call: Call = {
      method: init.method ?? 'GET',
      path: String(input).replace('https://ref.supabase.co/storage/v1', ''),
      headers: Object.fromEntries(
        Object.entries((init.headers ?? {}) as Record<string, string>).map(([k, v]) => [
          k.toLowerCase(),
          v,
        ]),
      ),
      body: init.body,
    };
    calls.push(call);
    const { status, body } = reply(call);
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

test('config is read from SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY', () => {
  assert.deepEqual(readStorageConfig(ENV), CONFIG);
});

test('a trailing slash on the project URL is dropped', () => {
  assert.equal(readStorageConfig({ ...ENV, SUPABASE_URL: 'https://ref.supabase.co//' }).url, 'https://ref.supabase.co'); // prettier-ignore
});

test('the bucket has a default and is overridable', () => {
  assert.equal(readStorageConfig(ENV).bucket, 'portfolio-media');
  assert.equal(readStorageConfig({ ...ENV, SUPABASE_STORAGE_BUCKET: 'other' }).bucket, 'other');
});

test('a missing key fails closed rather than defaulting', () => {
  assert.throws(
    () => readStorageConfig({ SUPABASE_URL: ENV.SUPABASE_URL }),
    (err: unknown) => err instanceof StorageConfigError && /SERVICE_ROLE_KEY/.test(String(err)),
  );
});

test('a missing URL fails closed', () => {
  assert.throws(
    () => readStorageConfig({ SUPABASE_SERVICE_ROLE_KEY: 'k' }),
    (err: unknown) => err instanceof StorageConfigError,
  );
});

test('a URL that is not a URL is rejected', () => {
  assert.throws(
    () => readStorageConfig({ ...ENV, SUPABASE_URL: 'ref.supabase.co' }),
    /must be a URL/,
  );
});

// ---------------------------------------------------------------------------
// Signing
// ---------------------------------------------------------------------------

test('signing returns an absolute upload URL and the public URL it will land at', async () => {
  const stub = stubFetch(() => ({
    status: 200,
    body: { url: '/object/upload/sign/portfolio-media/u/1/x.png?token=tok' },
  }));

  try {
    const signed = await createSignedUploadUrl(CONFIG, 'u/1/x.png');

    assert.equal(stub.calls[0]?.method, 'POST');
    assert.equal(stub.calls[0]?.path, '/object/upload/sign/portfolio-media/u/1/x.png');
    assert.equal(stub.calls[0]?.headers.authorization, 'Bearer service-key');
    assert.equal(
      signed.uploadUrl,
      'https://ref.supabase.co/storage/v1/object/upload/sign/portfolio-media/u/1/x.png?token=tok',
    );
    assert.equal(
      signed.publicUrl,
      'https://ref.supabase.co/storage/v1/object/public/portfolio-media/u/1/x.png',
    );
    assert.equal(signed.path, 'u/1/x.png');
  } finally {
    stub.restore();
  }
});

test('a signing response with no URL is an upstream failure, not a silent success', async () => {
  const stub = stubFetch(() => ({ status: 200, body: {} }));
  try {
    await assert.rejects(
      () => createSignedUploadUrl(CONFIG, 'u/1/x.png'),
      (err: unknown) => err instanceof StorageApiError && err.status === 502,
    );
  } finally {
    stub.restore();
  }
});

test("a refused signing surfaces Supabase's own message", async () => {
  const stub = stubFetch(() => ({ status: 400, body: { message: 'Bucket not found' } }));
  try {
    await assert.rejects(
      () => createSignedUploadUrl(CONFIG, 'u/1/x.png'),
      (err: unknown) => err instanceof StorageApiError && /Bucket not found/.test(String(err)),
    );
  } finally {
    stub.restore();
  }
});

// ---------------------------------------------------------------------------
// Server-side upload (the migration script's path)
// ---------------------------------------------------------------------------

test('uploading sends the bytes with their content type and returns the public URL', async () => {
  const stub = stubFetch(() => ({ status: 200, body: { Key: 'portfolio-media/seed/a.png' } }));

  try {
    const url = await uploadObject(CONFIG, 'seed/a.png', new Uint8Array([1, 2, 3]), 'image/png');

    assert.equal(stub.calls[0]?.method, 'POST');
    assert.equal(stub.calls[0]?.path, '/object/portfolio-media/seed/a.png');
    assert.equal(stub.calls[0]?.headers['content-type'], 'image/png');
    assert.equal(
      url,
      'https://ref.supabase.co/storage/v1/object/public/portfolio-media/seed/a.png',
    );
  } finally {
    stub.restore();
  }
});

test('uploading overwrites, so a re-run of the migration is idempotent', async () => {
  const stub = stubFetch(() => ({ status: 200, body: {} }));
  try {
    await uploadObject(CONFIG, 'seed/a.png', new Uint8Array([1]), 'image/png');
    assert.equal(stub.calls[0]?.headers['x-upsert'], 'true');
  } finally {
    stub.restore();
  }
});

test('an unreachable Supabase is a 504, not an unhandled rejection', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (() => Promise.reject(new Error('getaddrinfo ENOTFOUND'))) as typeof fetch;
  try {
    await assert.rejects(
      () => uploadObject(CONFIG, 'seed/a.png', new Uint8Array([1]), 'image/png'),
      (err: unknown) => err instanceof StorageApiError && err.status === 504,
    );
  } finally {
    globalThis.fetch = original;
  }
});
