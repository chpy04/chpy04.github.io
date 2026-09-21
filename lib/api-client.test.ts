import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, uploadMedia } from './api-client.ts';

/**
 * Only the upload path is covered here. The rest of this module is one line
 * per endpoint over `requestJson`, and a test of it would assert that a
 * string literal is the string literal.
 *
 * The upload is different: it is two requests with a handoff between them,
 * and the branch that matters most is the one where neither answers. A
 * failure that does not surface leaves the drop zone saying "Uploading…"
 * for ever, which is the shape of the bug that prompted these tests.
 */

interface Call {
  url: string;
  method: string;
  body: unknown;
}

/** `File` here only ever has its name, type and size read, and constructing
 *  a real one needs a DOM. */
function fakeFile(name = 'photo.png', type = 'image/png', size = 1024): File {
  return { name, type, size } as unknown as File;
}

function stubFetch(reply: (call: Call) => Response | Promise<Response>): {
  calls: Call[];
  restore: () => void;
} {
  const calls: Call[] = [];
  const original = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const call: Call = {
      url: String(input),
      method: init.method ?? 'GET',
      body: init.body,
    };
    calls.push(call);
    return reply(call);
  }) as typeof fetch;

  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const SIGNED = {
  uploadUrl: 'https://ref.supabase.co/storage/v1/object/upload/sign/b/k?token=t',
  publicUrl: 'https://ref.supabase.co/storage/v1/object/public/b/k',
  path: 'k',
};

test('an upload signs, PUTs the bytes, and returns the public URL', async () => {
  const stub = stubFetch((call) => (call.url === '/api/uploads' ? json(SIGNED, 201) : json({})));

  try {
    const url = await uploadMedia(fakeFile('photo.png', 'image/png', 2048));

    assert.equal(url, SIGNED.publicUrl);
    assert.equal(stub.calls.length, 2);

    // The app is told *about* the file; it is never sent the file.
    assert.equal(stub.calls[0]?.url, '/api/uploads');
    assert.deepEqual(JSON.parse(String(stub.calls[0]?.body)), {
      filename: 'photo.png',
      contentType: 'image/png',
      bytes: 2048,
    });

    // The bytes go to Supabase, at the URL the server signed.
    assert.equal(stub.calls[1]?.url, SIGNED.uploadUrl);
    assert.equal(stub.calls[1]?.method, 'PUT');
  } finally {
    stub.restore();
  }
});

test("a refused signature surfaces the server's own message and never PUTs", async () => {
  const stub = stubFetch(() => json({ error: 'file storage is not configured' }, 503));

  try {
    await assert.rejects(
      () => uploadMedia(fakeFile()),
      (err: unknown) =>
        err instanceof ApiError && err.status === 503 && /not configured/.test(err.message),
    );
    assert.equal(stub.calls.length, 1, 'the bytes were sent anyway');
  } finally {
    stub.restore();
  }
});

test('a refused PUT is reported with its status', async () => {
  const stub = stubFetch((call) =>
    call.url === '/api/uploads' ? json(SIGNED, 201) : new Response('nope', { status: 413 }),
  );

  try {
    await assert.rejects(
      () => uploadMedia(fakeFile()),
      (err: unknown) => err instanceof ApiError && err.status === 413,
    );
  } finally {
    stub.restore();
  }
});

test('a connection that dies mid-upload is an error, not a silent stall', async () => {
  const stub = stubFetch((call) => {
    if (call.url === '/api/uploads') return json(SIGNED, 201);
    // What Chromium does when the TLS connection drops under a large body.
    throw new TypeError('Failed to fetch');
  });

  try {
    await assert.rejects(
      () => uploadMedia(fakeFile('holiday.gif')),
      (err: unknown) =>
        err instanceof ApiError &&
        err.status === 0 &&
        /holiday\.gif did not finish uploading/.test(err.message),
    );
  } finally {
    stub.restore();
  }
});

test('a signing request that never answers is an error too', async () => {
  const stub = stubFetch(() => {
    throw new DOMException('The operation was aborted.', 'TimeoutError');
  });

  try {
    await assert.rejects(
      () => uploadMedia(fakeFile()),
      (err: unknown) => err instanceof ApiError && err.status === 0,
    );
  } finally {
    stub.restore();
  }
});
