/**
 * Creates the one user local development runs as, and fills their
 * portfolio from `scripts/seed-data/`.
 *
 * `dev` auth mode signs in as the *first* user in the table, and
 * `lib/site-owner.ts` shows that same user's content, so this script is
 * what decides both who you are locally and what the page says. Nothing
 * works before it has run once.
 *
 * Idempotent by default: re-running does nothing if a user already exists.
 *
 * `--force` **truncates every table below and reseeds from scratch** —
 * every user, not just the seeded one. That is deliberate and it matters:
 * the query test fixtures create extra accounts, and `password` auth mode
 * refuses to log in when several users exist and `OWNER_EMAIL` is unset
 * (it cannot tell them apart). So "exactly one user after a force reseed"
 * is what lets the browser suite log in at all.
 *
 * It follows that this is a **development-only** script pointed at a
 * development database. `npm run verify` runs it before `smoke` because a
 * Playwright run leaves edited rows behind.
 *
 * Add every new table to `ALL_SEEDED_TABLES`. A table missing from that list
 * keeps its rows across a force reseed and is the kind of thing that
 * surfaces as one test failing on a colleague's machine.
 *
 * Usage: node --experimental-strip-types scripts/seed.ts [--force]
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { db, sql } from '../lib/db/index.ts';
import {
  project,
  projectCategory,
  siteProfile,
  socialLink,
  timelineEntry,
  users,
  type TimelineKind,
} from '../lib/db/schema.ts';
import { provisionUser } from '../lib/queries/users.ts';

const DEFAULT_EMAIL = 'dev@example.test';
const DEFAULT_NAME = 'Dev User';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), 'seed-data');

/**
 * Everything `--force` wipes. `truncate ... cascade` follows foreign keys
 * itself, so the order is only for readability (leaves first) — but the
 * *completeness* of this list is load-bearing.
 */
const ALL_SEEDED_TABLES = [
  'project_category',
  'project',
  'social_link',
  'timeline_entry',
  'site_profile',
  'users',
];

// ---------------------------------------------------------------------------
// The source data — the JSON files the site used to be configured with.
// ---------------------------------------------------------------------------

interface SourcePortfolio {
  name: string;
  metaDescription: string;
  headerTaglineOne: string;
  headerTaglineTwo: string;
  headerTaglineThree: string;
  headerTaglineFour: string;
  aboutpara: string;
  /** Absolute URLs into the media bucket, like every other image the seed
   *  carries — see `scripts/upload-media.ts`. */
  headshot: string;
  resumeImage: string;
  resumePdf: string;
  socials: { title: string; link: string }[];
  projects: {
    title: string;
    subtitle: string;
    categories: string[];
    imageSrc: string;
    externalLink?: string;
    fileName?: string;
  }[];
}

interface SourceTimelineEntry {
  organization: string;
  title: string;
  description: string;
  start: string;
  end?: string;
  type: string;
  /** An absolute URL, not a filename: the media moved to Supabase Storage
   *  (D-024) and `scripts/upload-media.ts` rewrote these in place. */
  thumbnail: string;
}

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(dataDir, name), 'utf8')) as T;
}

/**
 * `<a href="x">y</a>` -> `[y](x)`.
 *
 * The old timeline descriptions were HTML rendered with
 * `dangerouslySetInnerHTML`. Descriptions are markdown now and are
 * rendered sanitized, so the two anchors in the source data are converted
 * here rather than left as literal tags that would show as escaped text.
 */
function htmlLinksToMarkdown(html: string): string {
  return html.replace(/<a\s+href="([^"]+)"\s*>(.*?)<\/a>/g, '[$2]($1)');
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

  const force = process.argv.includes('--force');
  const email = process.env.SEED_USER_EMAIL?.trim() || DEFAULT_EMAIL;
  const name = process.env.SEED_USER_NAME?.trim() || DEFAULT_NAME;

  const [existing] = await db.select({ id: users.id }).from(users).limit(1);

  if (existing && !force) {
    console.log('Already seeded (a user exists) — nothing to do.');
    console.log('Pass --force to wipe and reseed.');
    return;
  }

  if (existing && force) {
    // `truncate ... cascade` rather than DELETE: it ignores the
    // `on delete restrict` actions the tables normally carry, which exist to
    // stop application code deleting content (D-003) and are not meant to
    // stop the dev seed from resetting the database.
    console.log(`--force: truncating ${ALL_SEEDED_TABLES.length} tables before reseeding...`);
    await sql.unsafe(`truncate table ${ALL_SEEDED_TABLES.join(', ')} restart identity cascade`);
  }

  const user = await provisionUser({ email, name });
  console.log(`Created user ${user.email} (${user.id})`);

  const source = readJson<SourcePortfolio>('portfolio.json');
  const timeline = readJson<SourceTimelineEntry[]>('timeline.json');

  await db.insert(siteProfile).values({
    userId: user.id,
    name: source.name,
    metaDescription: source.metaDescription,
    taglineLead: source.headerTaglineOne,
    taglineName: source.headerTaglineTwo,
    taglineRole: source.headerTaglineThree.trim(),
    taglineOrg: source.headerTaglineFour,
    about: source.aboutpara,
    headshotPath: source.headshot,
    resumeImagePath: source.resumeImage,
    resumePdfPath: source.resumePdf,
  });
  console.log('Seeded the site profile.');

  for (const [index, social] of source.socials.entries()) {
    await db.insert(socialLink).values({
      userId: user.id,
      label: social.title,
      url: social.link,
      sortOrder: index,
    });
  }
  console.log(`Seeded ${source.socials.length} social link(s).`);

  // Each row gets an explicit, increasing `created_at`. `now()` is
  // transaction-start time in Postgres, so every row written in one
  // transaction ties — and a tie makes "ordered by creation" non-deterministic
  // across runs, which shows up as a flaky test long after the seed.
  const base = Date.now();

  for (const [index, spec] of source.projects.entries()) {
    // The write-ups used to be markdown files served out of `public/` and
    // fetched by the modal. They are content, so they live in the database
    // now and `scripts/seed-data/writeups/` is only their origin.
    const writeup = spec.fileName
      ? readFileSync(join(dataDir, 'writeups', spec.fileName), 'utf8')
      : '';

    const [row] = await db
      .insert(project)
      .values({
        userId: user.id,
        title: spec.title,
        subtitle: spec.subtitle,
        imagePath: spec.imageSrc,
        externalUrl: spec.externalLink ?? null,
        writeup,
        sortOrder: index,
        createdAt: new Date(base + index),
      })
      .returning({ id: project.id });
    if (!row) throw new Error(`failed to seed project "${spec.title}"`);

    for (const [categoryIndex, label] of spec.categories.entries()) {
      await db.insert(projectCategory).values({
        projectId: row.id,
        label,
        sortOrder: categoryIndex,
        createdAt: new Date(base + index + categoryIndex),
      });
    }
  }
  console.log(`Seeded ${source.projects.length} project(s).`);

  for (const [index, entry] of timeline.entries()) {
    await db.insert(timelineEntry).values({
      userId: user.id,
      organization: entry.organization,
      title: entry.title,
      description: htmlLinksToMarkdown(entry.description),
      startsOn: entry.start,
      endsOn: entry.end ?? null,
      kind: entry.type as TimelineKind,
      thumbnailPath: entry.thumbnail,
      createdAt: new Date(base + index),
    });
  }
  console.log(`Seeded ${timeline.length} timeline entr(ies).`);
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 1 });
}
