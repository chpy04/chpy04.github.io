/**
 * The acceptance bar: does the app's core promise still hold against a real
 * database?
 *
 * The promise is one sentence — **the portfolio the page renders comes out
 * of the database, and the owner can change it without a deploy** — so the
 * checks below are that sentence taken apart: the owner resolves, their
 * content loads through the same query layer the page uses, nothing
 * internal leaks onto the wire, the ordering is stable, and an edit
 * round-trips.
 *
 * Not a unit test. It reads **live** state, so it catches the class of
 * break that unit tests with fixtures cannot — a migration that landed but
 * was never applied, a seed that no longer matches the schema, an ordering
 * that only ties in production data.
 *
 * Because it reads live state, run `npm run db:seed -- --force` first. A
 * previous Playwright run leaves edited rows behind and the assertions
 * below will fail for reasons that have nothing to do with your change;
 * `npm run verify` reseeds for exactly this reason.
 *
 * Usage: node --experimental-strip-types scripts/smoke.ts
 */

import { getSiteContent, publicView } from '../lib/queries/content.ts';
import { updateProfile } from '../lib/queries/profile.ts';
import { getSiteOwner } from '../lib/site-owner.ts';
import { sql } from '../lib/db/index.ts';

let failures = 0;

function check(label: string, ok: boolean, detail = ''): void {
  if (ok) {
    console.log(`  ok    ${label}`);
  } else {
    failures++;
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

  console.log('smoke: reading live database state\n');

  // 1. There is a site to show at all. Everything else depends on this
  //    resolving the same way the page does.
  const owner = await getSiteOwner();
  if (!owner) throw new Error('no site owner — run `npm run db:seed` first');
  console.log(`  owner ${owner.email} (${owner.id})\n`);

  const content = await getSiteContent(owner.id);

  // 2. The seed produced a page's worth of content, and it round-trips
  //    through the query layer rather than only through the inserts.
  check('the profile loads', content.profile.taglineName.length > 0);
  check('projects load', content.projects.length > 0, `got ${content.projects.length}`);
  check('social links load', content.socials.length > 0, `got ${content.socials.length}`);
  check('timeline entries load', content.timeline.length > 0, `got ${content.timeline.length}`);

  // 3. Wire shape. The regression this catches is a query returning raw
  //    rows: it typechecks, and it ships user_id and timestamps to every
  //    browser that loads the public page.
  const leaky = [...content.projects, ...content.socials, ...content.timeline].filter(
    (row) => 'userId' in row || 'createdAt' in row,
  );
  check('no internal columns leak to the wire', leaky.length === 0, `${leaky.length} row(s)`);
  check(
    'the profile does not leak internal columns',
    !('userId' in content.profile) && !('createdAt' in content.profile),
  );

  // 4. Child rows are attached to the right parents.
  const tagged = content.projects.find((row) => row.categories.length > 0);
  check('projects carry their categories', Boolean(tagged));

  // 5. Ordering is stable. Two reads in a row must agree — if `sort_order`
  //    ties and nothing breaks the tie, they will not.
  const again = await getSiteContent(owner.id);
  check(
    'project ordering is deterministic across reads',
    JSON.stringify(content.projects.map((r) => r.id)) ===
      JSON.stringify(again.projects.map((r) => r.id)),
  );
  check(
    'the timeline is ordered oldest first',
    content.timeline.every(
      (row, i) => i === 0 || (content.timeline[i - 1]?.startsOn ?? '') <= row.startsOn,
    ),
  );

  // 6. The public view hides archived rows without the query layer having
  //    dropped them — the owner still needs them to restore.
  const publicContent = publicView(content);
  check(
    'the public view hides archived rows',
    publicContent.projects.every((row) => !row.isArchived) &&
      publicContent.socials.every((row) => !row.isArchived) &&
      publicContent.timeline.every((row) => !row.isArchived),
  );

  // 7. An edit, end to end, against the real database — then put it back,
  //    because the next run reads this same state.
  const original = content.profile.taglineLead;
  const edited = await updateProfile(owner.id, { taglineLead: 'smoke-test tagline' });
  check('an edit round-trips', edited.taglineLead === 'smoke-test tagline');
  const restored = await updateProfile(owner.id, { taglineLead: original });
  check('and can be put back', restored.taglineLead === original);

  console.log('');
  if (failures > 0) {
    console.error(`smoke: ${failures} check(s) FAILED`);
    process.exitCode = 1;
  } else {
    console.log('smoke: all checks passed');
  }
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 1 });
}
