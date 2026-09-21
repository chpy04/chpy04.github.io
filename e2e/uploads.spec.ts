import { expect, test, type Locator, type Page } from '@playwright/test';
import { setEditing, signIn } from './support';

/**
 * The promise: while editing, an image on the page is a place to drop a file,
 * and dropping one replaces it everywhere — without a commit, a deploy, or a
 * path typed by hand (D-024).
 *
 * The drop itself needs somewhere for the bytes to go, so the test that
 * performs one runs only where Supabase Storage is configured. The
 * affordance tests below run everywhere and are the ones that catch the
 * edit layer leaking into a reader's page.
 */

/** A 1×1 transparent PNG — small enough to inline, real enough to store. */
const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const hasStorage = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

test('a reader is never offered an upload', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('button', { name: /^Replace the/ })).toHaveCount(0);
  await expect(page.getByText('Replace', { exact: true })).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
});

test('every image on the page is a drop target while editing', async ({ page }) => {
  await signIn(page);
  await setEditing(page, true);

  for (const label of ['headshot', 'resume image', 'project image', 'timeline thumbnail']) {
    await expect(page.getByRole('button', { name: `Replace the ${label}` }).first()).toBeVisible();
  }

  // The resume PDF is the one file with no image to drop onto.
  await expect(page.getByRole('button', { name: 'Upload a PDF' })).toBeVisible();

  // And it says so without being hovered first. An affordance that only
  // exists under the cursor is one nobody knows to look for.
  expect(await page.getByText('Replace', { exact: true }).count()).toBeGreaterThan(3);
});

test('dragging a file in lights up every slot at once', async ({ page }) => {
  await signIn(page);
  await setEditing(page, true);

  await expect(page.getByText('Drop a file')).toHaveCount(0);

  // A file crossing the window, which is what the provider listens for —
  // no cursor has found a zone yet.
  await page
    .locator('body')
    .dispatchEvent('dragenter', { dataTransfer: await transfer(page, 'x.png', 'image/png', TINY_PNG) }); // prettier-ignore

  expect(await page.getByText('Drop a file').count()).toBeGreaterThan(3);
});

test('an image field refuses anything that is not an image', async ({ page }) => {
  await signIn(page);
  await setEditing(page, true);

  const zone = page.getByRole('button', { name: 'Replace the headshot' });
  await drop(page, zone, 'notes.txt', 'text/plain', 'bm90ZXM=');

  // Reported in the toolbar, like every other failed edit — and before any
  // round trip, so this holds with or without storage configured.
  await expect(page.getByText(/is not one of/)).toBeVisible();
});

test.describe('with storage configured', () => {
  test.skip(!hasStorage, 'needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  test('dropping an image stores it and the page keeps it', async ({ page }) => {
    await signIn(page);
    await setEditing(page, true);

    const field = page.getByRole('textbox', { name: 'Headshot' });
    const original = await field.inputValue();

    await drop(page, page.getByRole('button', { name: 'Replace the headshot' }), 'drop.png', 'image/png', TINY_PNG); // prettier-ignore

    // Wait on the *field*, not on the image. The seeded headshot is already a
    // bucket URL, so "the src looks like storage" is true before the drop and
    // asserting it would pass while the upload was still in flight — which is
    // how an earlier version of this test reloaded mid-PUT and proved nothing.
    //
    // Longer than the default 15s: this is the first request in the run to
    // reach `/api/uploads`, so it pays for the dev server compiling that
    // route, and then for a real round trip to Supabase and back.
    await expect(field).not.toHaveValue(original, { timeout: 45_000 });

    const stored = await field.inputValue();
    expect(stored).toContain('/object/public/');
    // Namespaced by the owner, from the session rather than from the request.
    expect(stored).toContain('/u/');
    // The filename survives into the key, which is what makes the optimizer's
    // `url=` parameter identifiable here.
    await expect(page.getByRole('img', { name: /portrait/ })).toHaveAttribute('src', /drop\.png/);

    // The real assertion: it reached the database. A reload re-renders on the
    // server, where React state does not exist.
    await page.reload();
    expect(await field.inputValue()).toBe(stored);

    // Put the seeded headshot back — the next run reads this same database.
    await field.fill(original);
    await field.blur();
    await page.reload();
    expect(await field.inputValue()).toBe(original);

    // And out of the bucket. The app never deletes an object (D-024) because
    // something may still point at it; nothing points at this one, and a
    // test that leaves a file behind on every run leaves a few hundred.
    await remove(stored);
  });
});

/** Deletes one object by its public URL, with the same key the server signs
 *  with — this runs only where that key is already in the environment. */
async function remove(publicUrl: string): Promise<void> {
  const [, key] = publicUrl.split(/\/object\/public\/[^/]+\//);
  if (!key) return;

  const base = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'portfolio-media';

  await fetch(`${base}/storage/v1/object/${bucket}/${key}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
  });
}

/**
 * The drop gesture, as a browser produces it. Playwright has no API for
 * dragging a file in from the desktop, so the `DataTransfer` is built in the
 * page and dispatched — which is exactly what the zone's handler reads.
 */
async function drop(
  page: Page,
  target: Locator,
  filename: string,
  contentType: string,
  base64: string,
): Promise<void> {
  await target.dispatchEvent('drop', {
    dataTransfer: await transfer(page, filename, contentType, base64),
  });
}

/** A `DataTransfer` carrying one file, built inside the page. */
function transfer(page: Page, filename: string, contentType: string, base64: string) {
  return page.evaluateHandle(
    async ([name, type, data]: string[]) => {
      const response = await fetch(`data:${type};base64,${data}`);
      const item = new DataTransfer();
      item.items.add(new File([await response.blob()], name!, { type: type! }));
      return item;
    },
    [filename, contentType, base64],
  );
}
