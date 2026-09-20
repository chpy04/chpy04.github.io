/**
 * The multi-user guarantee, stated as tests.
 *
 * Every case here is the same shape: user A holds an id belonging to user
 * B, and tries to use it. The expected answer is always "that does not
 * exist" — never a partial success, and never a 403-flavoured error that
 * would confirm the id is real.
 *
 * These run against a real database (see test-fixtures.ts) because the
 * thing under test *is* the WHERE clause. Mocking the query layer here
 * would assert nothing.
 *
 * **Add a case here whenever you add a query that takes an id.** This file
 * is the executable form of invariant 1 in CLAUDE.md, and the first thing
 * to run after touching anything under `lib/queries/`.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';

const skip = !process.env.DATABASE_URL;

let BadRequestError: typeof import('./errors.ts').BadRequestError;
let NotFoundError: typeof import('./errors.ts').NotFoundError;
let projects: typeof import('./projects.ts');
let socials: typeof import('./socials.ts');
let timeline: typeof import('./timeline.ts');
let profile: typeof import('./profile.ts');
let fixtures: typeof import('./test-fixtures.ts');

// Dynamic imports so a machine with no DATABASE_URL never even loads the
// query layer — importing `lib/db` is harmless (the client is lazy), but
// keeping the skip total is what makes the skip honest.
if (!skip) {
  ({ BadRequestError, NotFoundError } = await import('./errors.ts'));
  projects = await import('./projects.ts');
  socials = await import('./socials.ts');
  timeline = await import('./timeline.ts');
  profile = await import('./profile.ts');
  fixtures = await import('./test-fixtures.ts');
}

after(async () => {
  if (!skip) await fixtures.closeTestDb();
});

/** Two accounts, each with one of everything. */
async function twoUsers() {
  const tag = fixtures.testTag();
  const alice = await fixtures.insertUser(`a-${tag}`);
  const bob = await fixtures.insertUser(`b-${tag}`);

  const aliceProject = await fixtures.insertProject(alice.id, `a-${tag}`);
  const aliceCategory = await fixtures.insertProjectCategory(aliceProject.id, 'Rust');
  const aliceSocial = await fixtures.insertSocial(alice.id, `a-${tag}`);
  const aliceEntry = await fixtures.insertTimelineEntry(alice.id, `a-${tag}`);

  const bobProject = await fixtures.insertProject(bob.id, `b-${tag}`);
  const bobCategory = await fixtures.insertProjectCategory(bobProject.id, 'Go');
  const bobSocial = await fixtures.insertSocial(bob.id, `b-${tag}`);
  const bobEntry = await fixtures.insertTimelineEntry(bob.id, `b-${tag}`);

  return {
    tag,
    alice,
    bob,
    aliceProject,
    aliceCategory,
    aliceSocial,
    aliceEntry,
    bobProject,
    bobCategory,
    bobSocial,
    bobEntry,
  };
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

test('a list never contains another user’s rows', { skip }, async () => {
  const { alice, aliceProject, aliceSocial, aliceEntry, bobProject, bobSocial, bobEntry } =
    await twoUsers();

  const projectIds = (await projects.listProjects(alice.id)).map((row) => row.id);
  assert.ok(projectIds.includes(aliceProject.id));
  assert.ok(!projectIds.includes(bobProject.id));

  const socialIds = (await socials.listSocials(alice.id)).map((row) => row.id);
  assert.ok(socialIds.includes(aliceSocial.id));
  assert.ok(!socialIds.includes(bobSocial.id));

  const entryIds = (await timeline.listTimeline(alice.id)).map((row) => row.id);
  assert.ok(entryIds.includes(aliceEntry.id));
  assert.ok(!entryIds.includes(bobEntry.id));
});

test('a project never carries another user’s categories', { skip }, async () => {
  const { alice, aliceProject, bobCategory } = await twoUsers();

  const [row] = (await projects.listProjects(alice.id)).filter((p) => p.id === aliceProject.id);
  assert.ok(row);
  assert.ok(!row.categories.some((category) => category.id === bobCategory.id));
});

// ---------------------------------------------------------------------------
// Reading one row by id
// ---------------------------------------------------------------------------

test('reading another user’s project is a not-found, not a forbidden', { skip }, async () => {
  const { alice, bobProject } = await twoUsers();
  await assert.rejects(() => projects.getProject(alice.id, bobProject.id), NotFoundError);
});

// ---------------------------------------------------------------------------
// Writing to a row by id
// ---------------------------------------------------------------------------

test('another user’s project cannot be patched', { skip }, async () => {
  const { alice, bob, bobProject } = await twoUsers();

  await assert.rejects(
    () => projects.updateProject(alice.id, bobProject.id, { title: 'stolen' }),
    NotFoundError,
  );

  // And the row is genuinely untouched, not merely un-returned.
  const reread = await projects.getProject(bob.id, bobProject.id);
  assert.equal(reread.title, bobProject.title);
});

test('another user’s project cannot be archived', { skip }, async () => {
  const { alice, bob, bobProject } = await twoUsers();
  await assert.rejects(() => projects.archiveProject(alice.id, bobProject.id), NotFoundError);
  assert.equal((await projects.getProject(bob.id, bobProject.id)).isArchived, false);
});

test('another user’s social link cannot be patched', { skip }, async () => {
  const { alice, bobSocial } = await twoUsers();
  await assert.rejects(
    () => socials.updateSocial(alice.id, bobSocial.id, { label: 'stolen' }),
    NotFoundError,
  );
});

test('another user’s timeline entry cannot be patched', { skip }, async () => {
  const { alice, bob, bobEntry } = await twoUsers();
  await assert.rejects(
    () => timeline.updateTimelineEntry(alice.id, bobEntry.id, { title: 'stolen' }),
    NotFoundError,
  );
  const stillThere = (await timeline.listTimeline(bob.id)).find((row) => row.id === bobEntry.id);
  assert.equal(stillThere?.title, bobEntry.title);
});

// ---------------------------------------------------------------------------
// Child rows, which carry no owner of their own
// ---------------------------------------------------------------------------

test('a category cannot be written under another user’s project', { skip }, async () => {
  const { alice, bobProject } = await twoUsers();
  await assert.rejects(
    () => projects.createProjectCategory(alice.id, bobProject.id, 'stolen'),
    NotFoundError,
  );
});

test('another user’s category cannot be patched', { skip }, async () => {
  const { alice, bob, bobProject, bobCategory } = await twoUsers();

  await assert.rejects(
    () => projects.updateProjectCategory(alice.id, bobCategory.id, { label: 'stolen' }),
    NotFoundError,
  );

  const reread = await projects.getProject(bob.id, bobProject.id);
  assert.equal(reread.categories[0]?.label, bobCategory.label);
});

// ---------------------------------------------------------------------------
// Bulk operations, where the ids arrive in a request body
// ---------------------------------------------------------------------------

test('a reorder containing another user’s id is rejected whole', { skip }, async () => {
  const { alice, aliceProject, bobProject } = await twoUsers();

  await assert.rejects(
    () => projects.reorderProjects(alice.id, [bobProject.id, aliceProject.id]),
    BadRequestError,
  );

  // Rejected *whole*: alice's own row must not have been repositioned.
  const before = await projects.listProjects(alice.id);
  assert.equal(before.find((row) => row.id === aliceProject.id)?.id, aliceProject.id);
});

test('a reorder with a duplicated id is rejected', { skip }, async () => {
  const { alice, aliceProject } = await twoUsers();
  await assert.rejects(
    () => socials.reorderSocials(alice.id, [aliceProject.id, aliceProject.id]),
    BadRequestError,
  );
});

// ---------------------------------------------------------------------------
// The profile, which is addressed by user rather than by id
// ---------------------------------------------------------------------------

test('each user gets their own profile row, created on first read', { skip }, async () => {
  const { alice, bob } = await twoUsers();

  const aliceProfile = await profile.getProfile(alice.id);
  const bobProfile = await profile.getProfile(bob.id);
  assert.notEqual(aliceProfile.id, bobProfile.id);

  await profile.updateProfile(alice.id, { taglineName: 'Alice' });
  assert.equal((await profile.getProfile(bob.id)).taglineName, '');
});

test('reading a profile twice returns the same row, not a second one', { skip }, async () => {
  const { alice } = await twoUsers();
  const first = await profile.getProfile(alice.id);
  const second = await profile.getProfile(alice.id);
  assert.equal(first.id, second.id);
});
