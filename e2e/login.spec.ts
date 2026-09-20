import { expect, test } from '@playwright/test';
import { PASSWORD, signIn } from './support';

/**
 * Who gets the edit layer. Runs under `APP_AUTH_MODE=password` (see
 * playwright.config.ts) because that is the only mode with a login screen
 * to drive; `dev` and `supabase` are covered in-process by
 * `lib/session.test.ts`.
 *
 * The thing worth protecting here is not that the app is locked — it is
 * that the *page* never is. A portfolio that 401s at a stranger is broken
 * in a way no amount of working auth makes up for.
 */

test('the portfolio is public', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
  await expect(page.getByPlaceholder('Password')).toBeHidden();
  // No edit affordances for a reader.
  await expect(page.getByRole('button', { name: /^Editing|^Edit$/ })).toBeHidden();
});

test('a wrong password is rejected without reloading', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('Password').fill('definitely-not-it');
  await page.keyboard.press('Enter');

  await expect(page.getByText('Wrong password.')).toBeVisible();
  await expect(page.getByPlaceholder('Password')).toBeVisible();
});

test('the right password turns on the edit layer, and it survives a reload', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('Password').fill(PASSWORD);
  await page.keyboard.press('Enter');

  const toggle = page.getByRole('button', { name: /^Editing|^Edit$/ });
  await expect(toggle).toBeVisible();

  // The token is in localStorage, so a reload must not sign you out.
  await page.reload();
  await expect(toggle).toBeVisible();
});

test('an invalid token drops the edit layer rather than erroring', async ({ page }) => {
  await signIn(page);
  await page.evaluate(() => window.localStorage.setItem('app.token', 'not-a-real-token'));
  await page.reload();

  // The page itself is unaffected — that is the point.
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Editing|^Edit$/ })).toBeHidden();
});
