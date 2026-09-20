import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_DOCUMENT_TYPES,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
  acceptAttribute,
  chooseUpload,
  downloadUrl,
  extensionForMimeType,
  mediaObjectKey,
  mimeTypeForExtension,
  publicMediaUrl,
  slugifyFilename,
} from './media.ts';

const AT = new Date('2026-09-20T15:04:05.123Z');
const ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

// ---------------------------------------------------------------------------
// The allowlist
// ---------------------------------------------------------------------------

test('every allowed type maps to an extension', () => {
  for (const type of ALLOWED_UPLOAD_TYPES) {
    assert.ok(extensionForMimeType(type), `${type} has no extension`);
  }
});

test('a content type with parameters still resolves', () => {
  assert.equal(extensionForMimeType('image/png; charset=binary'), 'png');
  assert.equal(extensionForMimeType('IMAGE/JPEG'), 'jpg');
});

test('svg is not uploadable — it is a script host', () => {
  assert.equal(extensionForMimeType('image/svg+xml'), null);
});

test('video is not uploadable', () => {
  assert.equal(extensionForMimeType('video/quicktime'), null);
});

test('the image list is the full list without the documents', () => {
  assert.deepEqual(ALLOWED_DOCUMENT_TYPES, ['application/pdf']);
  assert.ok(ALLOWED_UPLOAD_TYPES.includes('application/pdf'));
  assert.ok(!ALLOWED_IMAGE_TYPES.includes('application/pdf'));
  assert.equal(ALLOWED_IMAGE_TYPES.length, ALLOWED_UPLOAD_TYPES.length - 1);
});

test('an extension on disk maps back to a content type', () => {
  assert.equal(mimeTypeForExtension('png'), 'image/png');
  assert.equal(mimeTypeForExtension('.gif'), 'image/gif');
  assert.equal(mimeTypeForExtension('pdf'), 'application/pdf');
});

test('jpg, jpeg and JPEG are the same thing', () => {
  assert.equal(mimeTypeForExtension('jpg'), 'image/jpeg');
  assert.equal(mimeTypeForExtension('jpeg'), 'image/jpeg');
  assert.equal(mimeTypeForExtension('JPEG'), 'image/jpeg');
});

test('an extension outside the allowlist has no content type', () => {
  assert.equal(mimeTypeForExtension('svg'), null);
  assert.equal(mimeTypeForExtension('DS_Store'), null);
});

test('the accept attribute is a comma-separated mime list', () => {
  assert.equal(acceptAttribute(['image/png', 'image/gif']), 'image/png,image/gif');
});

// ---------------------------------------------------------------------------
// Object keys
// ---------------------------------------------------------------------------

test('a filename becomes a readable slug', () => {
  assert.equal(slugifyFilename('Ski Racing (final).PNG'), 'ski-racing-final');
  assert.equal(slugifyFilename('headshot.jpg'), 'headshot');
  assert.equal(slugifyFilename('a.b.c.gif'), 'a-b-c');
});

test('a filename that slugs to nothing slugs to nothing, not to a dangling dash', () => {
  assert.equal(slugifyFilename('———.png'), '');
  assert.equal(mediaObjectKey({ userId: 'u1', filename: '———.png', mimeType: 'image/png', at: AT, id: ID }), 'u/u1/2026/09/2026-09-20T15-04-05-123Z-a1b2c3d4.png'); // prettier-ignore
});

test('a very long filename is truncated without leaving a trailing dash', () => {
  const slug = slugifyFilename(`${'a-'.repeat(60)}.png`);
  assert.ok(slug.length <= 40);
  assert.ok(!slug.endsWith('-'));
});

test('the key is namespaced by user, date-partitioned, and unique per upload', () => {
  const key = mediaObjectKey({
    userId: 'user-1',
    filename: 'headshot.jpg',
    mimeType: 'image/jpeg',
    at: AT,
    id: ID,
  });

  assert.equal(key, 'u/user-1/2026/09/2026-09-20T15-04-05-123Z-a1b2c3d4-headshot.jpg');
});

test('two uploads in the same millisecond get different keys', () => {
  const input = { userId: 'u', filename: 'x.png', mimeType: 'image/png', at: AT };
  assert.notEqual(
    mediaObjectKey({ ...input, id: ID }),
    mediaObjectKey({ ...input, id: '99999999-0000-4000-8000-000000000000' }),
  );
});

test('an unsupported type throws rather than inventing an extension', () => {
  assert.throws(
    () => mediaObjectKey({ userId: 'u', filename: 'x.svg', mimeType: 'image/svg+xml', at: AT, id: ID }), // prettier-ignore
    /unsupported upload type/,
  );
});

test('the public URL survives a trailing slash on the project URL', () => {
  assert.equal(
    publicMediaUrl('https://ref.supabase.co/', 'portfolio-media', 'u/1/x.png'),
    'https://ref.supabase.co/storage/v1/object/public/portfolio-media/u/1/x.png',
  );
});

test('a storage URL can be asked to download instead of open', () => {
  assert.equal(
    downloadUrl('https://ref.supabase.co/storage/v1/object/public/b/cv.pdf'),
    'https://ref.supabase.co/storage/v1/object/public/b/cv.pdf?download',
  );
  assert.equal(
    downloadUrl('https://ref.supabase.co/storage/v1/object/public/b/cv.pdf?v=2'),
    'https://ref.supabase.co/storage/v1/object/public/b/cv.pdf?v=2&download',
  );
});

test('a URL that is not in the bucket is left alone', () => {
  assert.equal(downloadUrl('/Chris-Pyle-CV.pdf'), '/Chris-Pyle-CV.pdf');
  assert.equal(downloadUrl(''), '');
});

// ---------------------------------------------------------------------------
// Choosing a file out of a drop
// ---------------------------------------------------------------------------

const PNG = { name: 'a.png', type: 'image/png', size: 1024 };

test('an acceptable file is taken', () => {
  const { file, error } = chooseUpload([PNG], ALLOWED_IMAGE_TYPES);
  assert.equal(file, PNG);
  assert.equal(error, null);
});

test('a multi-file drop takes the first acceptable one rather than refusing', () => {
  const doc = { name: 'notes.txt', type: 'text/plain', size: 10 };
  const { file } = chooseUpload([doc, PNG], ALLOWED_IMAGE_TYPES);
  assert.equal(file, PNG);
});

test('the content type is matched case-insensitively', () => {
  const { file } = chooseUpload([{ ...PNG, type: 'IMAGE/PNG' }], ALLOWED_IMAGE_TYPES);
  assert.ok(file);
});

test('a PDF is refused by an image field and taken by the resume field', () => {
  const pdf = { name: 'cv.pdf', type: 'application/pdf', size: 2048 };
  assert.equal(chooseUpload([pdf], ALLOWED_IMAGE_TYPES).file, null);
  assert.equal(chooseUpload([pdf], ALLOWED_UPLOAD_TYPES).file, pdf);
});

test('an empty drop explains itself', () => {
  const { file, error } = chooseUpload([], ALLOWED_IMAGE_TYPES);
  assert.equal(file, null);
  assert.match(error ?? '', /no file/);
});

test('a rejected type names what would have been accepted', () => {
  const { error } = chooseUpload(
    [{ name: 'clip.mov', type: 'video/quicktime', size: 10 }],
    ALLOWED_IMAGE_TYPES,
  );
  assert.match(error ?? '', /png/);
});

test('a zero-byte file is refused', () => {
  const { error } = chooseUpload([{ ...PNG, size: 0 }], ALLOWED_IMAGE_TYPES);
  assert.match(error ?? '', /empty/);
});

test('a file over the limit is refused before any round trip', () => {
  const { file, error } = chooseUpload(
    [{ ...PNG, size: MAX_UPLOAD_BYTES + 1 }],
    ALLOWED_IMAGE_TYPES,
  );
  assert.equal(file, null);
  assert.match(error ?? '', /50 MB/);
});

test('a file exactly at the limit is allowed', () => {
  const { file } = chooseUpload([{ ...PNG, size: MAX_UPLOAD_BYTES }], ALLOWED_IMAGE_TYPES);
  assert.ok(file);
});
