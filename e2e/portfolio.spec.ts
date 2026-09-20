import { expect, test } from '@playwright/test';
import { editInPlace, setEditing, signIn, uniqueText } from './support';

/**
 * The app's actual promise, in a browser: the page is rendered from the
 * database, and the owner can change it in place without a deploy.
 *
 * These run against a real Postgres and leave their edits behind, which is
 * why `npm run verify` reseeds before `smoke`.
 */

test('the page renders its content from the database', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).not.toBeEmpty();
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'About' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Resume' })).toBeVisible();
});

test('a reader sees no editing affordances at all', async ({ page }) => {
  await page.goto('/');

  const heading = page.getByRole('heading', { level: 1 });
  await heading.dblclick();
  // Not merely unstyled — there is no contenteditable to enter.
  await expect(heading).not.toHaveAttribute('contenteditable', /.*/);
});

test('the owner edits a heading in place and it persists', async ({ page }) => {
  await signIn(page);
  await setEditing(page, true);

  const original = (await page.getByRole('heading', { level: 1 }).innerText()).trim();
  const replacement = uniqueText('Edited');

  await editInPlace(page, original, replacement);
  await expect(page.getByRole('heading', { name: replacement })).toBeVisible();

  // The real assertion: it is in the database, not just in React state. A
  // reload re-renders on the server from scratch.
  await page.reload();
  await expect(page.getByRole('heading', { name: replacement })).toBeVisible();

  await editInPlace(page, replacement, original);
  await expect(page.getByRole('heading', { name: original })).toBeVisible();
});

test('escape abandons an edit instead of saving it', async ({ page }) => {
  await signIn(page);
  await setEditing(page, true);

  const heading = page.getByRole('heading', { level: 1 });
  const original = (await heading.innerText()).trim();

  await heading.dblclick();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('this should not be saved');
  await page.keyboard.press('Escape');

  await expect(page.getByRole('heading', { name: original })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: original })).toBeVisible();
});

test('switching editing off restores the reader view', async ({ page }) => {
  await signIn(page);
  await setEditing(page, true);

  // While editing, a project card is not a link — that is what makes its
  // title double-clickable.
  await expect(page.locator('#projects a').first()).toBeHidden();

  await page.getByRole('button', { name: /^Editing/ }).click();
  await expect(page.locator('#projects a').first()).toBeVisible();
});

test('an archived entry is hidden but still reachable to restore', async ({ page }) => {
  await signIn(page);
  await setEditing(page, true);

  const firstCard = page.locator('#projects li').first();
  const title = (await firstCard.getByRole('heading').innerText()).trim();

  await firstCard.getByRole('button', { name: `Archive ${title}` }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeHidden();

  // Archived, not deleted: the owner can always find it again (D-003).
  await page.getByRole('button', { name: 'Show archived' }).click();
  const restored = page.getByRole('heading', { name: title, exact: true });
  await expect(restored).toBeVisible();

  await page
    .locator('#projects li')
    .filter({ hasText: title })
    .first()
    .getByRole('button', { name: `Restore ${title}` })
    .click();
  await expect(page.getByRole('button', { name: `Archive ${title}` })).toBeVisible();
});
