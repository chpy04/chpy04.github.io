/**
 * Moves the seed's images out of the repository and into Supabase Storage,
 * then rewrites the seed data to point at them (D-024).
 *
 * It is the tool that made the repo stop carrying 50 MB of PNGs, and it stays
 * because the same thing has to happen to any image added to the seed later:
 * drop the file under `public/images/`, reference it the old way, run this,
 * and the reference becomes a bucket URL.
 *
 * Three kinds of reference, all rewritten in place as **text** rather than
 * by re-serializing — the files stay byte-identical apart from the URLs:
 *
 *   - `scripts/seed-data/portfolio.json` — `/images/...` anywhere in it;
 *   - `scripts/seed-data/timeline.json` — `"thumbnail": "x.png"`, which used
 *     to be a bare filename the seed prefixed;
 *   - `scripts/seed-data/writeups/*.md` — markdown image links.
 *
 * Idempotent in both directions: a reference that is already a URL is left
 * alone, and an upload overwrites the same key rather than making a second
 * copy. A reference whose file is missing is reported and left as it is —
 * this script does not get to decide that a broken link should stay broken
 * in a new way.
 *
 * Usage:
 *   node --env-file-if-exists=.env --experimental-strip-types \
 *     scripts/upload-media.ts [--dry-run]
 *
 * Needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Nothing else here
 * touches the database: the rows are updated by re-seeding (or, for a
 * deployed database, by a one-off UPDATE — see docs/DEPLOYMENT.md).
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mimeTypeForExtension } from '../lib/storage/media.ts';
import { readStorageConfig, uploadObject, type StorageConfig } from '../lib/storage/supabase.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const publicDir = join(repoRoot, 'public');
const dataDir = join(here, 'seed-data');
const writeupsDir = join(dataDir, 'writeups');

/** Where a repo-relative path lands in the bucket: `/images/a.png` ->
 *  `seed/images/a.png`. Prefixed because the rest of the bucket is
 *  `u/<userId>/…`, and this content predates having an owner — the seed
 *  creates a new user every time it runs, so it cannot be namespaced by one. */
function bucketKeyFor(localPath: string): string {
  return `seed${localPath}`;
}

const dryRun = process.argv.includes('--dry-run');

const uploaded = new Map<string, string>();
const missing = new Set<string>();

async function urlFor(cfg: StorageConfig, localPath: string): Promise<string | null> {
  const cached = uploaded.get(localPath);
  if (cached) return cached;

  const file = join(publicDir, localPath);
  let bytes: Buffer;
  try {
    bytes = readFileSync(file);
  } catch {
    missing.add(localPath);
    return null;
  }

  const extension = localPath.slice(localPath.lastIndexOf('.') + 1);
  const mimeType = mimeTypeForExtension(extension);
  if (!mimeType) {
    console.warn(`  skip  ${localPath} — no content type for .${extension}`);
    missing.add(localPath);
    return null;
  }

  const key = bucketKeyFor(localPath);
  const url = dryRun
    ? `https://dry-run.invalid/${key}`
    : await uploadObject(cfg, key, bytes, mimeType);

  console.log(`  up    ${localPath} -> ${key} (${(bytes.length / 1024).toFixed(0)} KB)`);
  uploaded.set(localPath, url);
  return url;
}

/**
 * Every repo-relative media path in a file, rewritten to its bucket URL.
 *
 * The lookbehind is what keeps this off the path half of an external link:
 * in `https://github.com/o/r.png` the match would start after `com`, which
 * is a word character, and in `/images/x.png` it starts after a quote or a
 * bracket. Extensions rather than a `/images/` prefix, because the resume
 * PDF sits at the root.
 */
const MEDIA_REFERENCE = /(?<![\w:/.])\/[A-Za-z0-9_./-]+\.(?:png|jpe?g|gif|webp|avif|pdf)\b/gi;

async function rewritePaths(cfg: StorageConfig, text: string): Promise<string> {
  const references = [...new Set(text.match(MEDIA_REFERENCE) ?? [])];
  let next = text;

  for (const reference of references) {
    const url = await urlFor(cfg, reference);
    if (url) next = next.split(reference).join(url);
  }
  return next;
}

/** `"thumbnail": "unicode.png"` — the one reference that is a bare filename,
 *  because the seed used to supply the directory. */
async function rewriteThumbnails(cfg: StorageConfig, text: string): Promise<string> {
  const pattern = /("thumbnail":\s*")([^"]+)(")/g;
  const names = [...text.matchAll(pattern)]
    .map((match) => match[2]!)
    .filter((value) => !value.startsWith('http'));

  let next = text;
  for (const name of [...new Set(names)]) {
    const url = await urlFor(cfg, `/images/timeline/${name}`);
    if (url) next = next.split(`"thumbnail": "${name}"`).join(`"thumbnail": "${url}"`);
  }
  return next;
}

function write(path: string, before: string, after: string): void {
  if (before === after) return;
  if (!dryRun) writeFileSync(path, after);
  console.log(`  edit  ${path.replace(`${repoRoot}/`, '')}`);
}

async function main(): Promise<void> {
  const cfg = readStorageConfig();
  console.log(`upload-media: ${cfg.url}, bucket "${cfg.bucket}"${dryRun ? ' (dry run)' : ''}\n`);

  for (const name of ['portfolio.json', 'timeline.json']) {
    const path = join(dataDir, name);
    const before = readFileSync(path, 'utf8');
    const after = await rewriteThumbnails(cfg, await rewritePaths(cfg, before));
    write(path, before, after);
  }

  for (const name of readdirSync(writeupsDir)) {
    const path = join(writeupsDir, name);
    if (!statSync(path).isFile() || !name.endsWith('.md')) continue;
    const before = readFileSync(path, 'utf8');
    write(path, before, await rewritePaths(cfg, before));
  }

  console.log(`\nupload-media: ${uploaded.size} file(s) in the bucket.`);

  if (missing.size > 0) {
    // These were already broken before the move — the files are referenced by
    // a write-up but have never been in the repo. Left pointing where they
    // pointed, and worth fixing separately.
    console.warn(`\n${missing.size} reference(s) had no file and were left alone:`);
    for (const path of [...missing].sort()) console.warn(`  ${path}`);
  }
}

await main();
