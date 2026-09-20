import { expect, type Page } from '@playwright/test';

/** Matches `playwright.config.ts`'s `webServer.env`. */
export const PASSWORD = 'e2e-password';

/** Where the admin toolbar's editing switch remembers itself. */
const EDITING_KEY = 'portfolio.editing';

/**
 * Signs in as the site owner and lands back on the portfolio.
 *
 * Unlike the template this grew out of, `/` is never gated — the portfolio
 * renders for anyone. `/login` is a route you have to know about, and what
 * it unlocks is the edit layer, so "logged in" is asserted by the admin
 * toolbar appearing rather than by the page appearing.
 */
export async function signIn(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByPlaceholder('Password').fill(PASSWORD);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: /^Editing|^Edit$/ })).toBeVisible();
}

/** Puts the edit layer into a known state; it is persisted across loads, so
 *  a previous test's toggle would otherwise leak into this one. */
export async function setEditing(page: Page, on: boolean): Promise<void> {
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key as string, value as string),
    [EDITING_KEY, String(on)],
  );
  await page.reload();
}

/**
 * Double-clicks a span and types a new value into it, the way a person
 * would. Returns once the element is no longer being edited, which is the
 * point at which the save has been issued.
 */
export async function editInPlace(page: Page, current: string, next: string): Promise<void> {
  const target = page.getByText(current, { exact: true }).first();
  await target.dblclick();
  await expect(target).toHaveAttribute('contenteditable', 'plaintext-only');

  // Select-all then type: the component selects the contents on entry, but
  // saying so explicitly keeps the test readable.
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(next);
  await page.keyboard.press('Enter');
}

/** A string nothing else in the shared database will collide with. */
export function uniqueText(prefix: string): string {
  return `${prefix} ${Math.random().toString(36).slice(2, 10)}`;
}
