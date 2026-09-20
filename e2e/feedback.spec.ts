import { expect, test } from '@playwright/test';
import { signIn } from './support';

/**
 * The feedback widget's UI contract. What it deliberately does *not* do is
 * file a real report: filing to GitHub needs a token with write access, and
 * a suite that opens issues on every run is a suite nobody keeps. The
 * GitHub call is covered by `lib/feedback/github.test.ts` against a stubbed
 * `fetch`.
 *
 * So the assertion here is the boundary: the form collects a report and the
 * request reaches `POST /api/feedback`. The response is intercepted.
 */

test('the widget is not offered to a reader', async ({ page }) => {
  await page.goto('/');
  // Its API call needs a session, so for a reader it would be a button that
  // can only fail.
  await expect(page.getByRole('button', { name: 'Give feedback' })).toBeHidden();
});

test('the owner gets the widget', async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole('button', { name: 'Give feedback' })).toBeVisible();
});

test('a report reaches the API and names where it landed', async ({ page }) => {
  await signIn(page);

  await page.route('**/api/feedback', async (route) => {
    const request = route.request();
    expect(request.method()).toBe('POST');
    // multipart, not JSON — a screenshot has to be able to ride along.
    expect(request.headers()['content-type']).toContain('multipart/form-data');

    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        target: 'github',
        reference: '#123',
        url: 'https://github.com/owner/repo/issues/123',
        screenshotUploaded: true,
      }),
    });
  });

  await page.getByRole('button', { name: 'Give feedback' }).click();
  await page.getByPlaceholder(/what happened/i).fill('The timeline dots overlap at 1440px.');
  await page.getByRole('button', { name: 'Send feedback' }).click();

  await expect(page.getByRole('link', { name: 'issue #123' })).toBeVisible();
});

test('a report written to a local file says so, with no dead link', async ({ page }) => {
  await signIn(page);

  // The no-GITHUB_TOKEN path, which is the one a fresh checkout actually
  // hits: the report is written to ./feedback rather than refused.
  await page.route('**/api/feedback', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        target: 'local',
        reference: 'feedback/2026-09-20-bug-something.md',
        url: null,
        screenshotUploaded: true,
      }),
    }),
  );

  await page.getByRole('button', { name: 'Give feedback' }).click();
  await page.getByPlaceholder(/what happened/i).fill('Anything.');
  await page.getByRole('button', { name: 'Send feedback' }).click();

  await expect(page.getByText('feedback/2026-09-20-bug-something.md')).toBeVisible();
  await expect(page.getByRole('link', { name: /issue/ })).toBeHidden();
});

test('a server error is shown rather than swallowed', async ({ page }) => {
  await signIn(page);

  await page.route('**/api/feedback', (route) =>
    route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'GitHub rejected the issue: GitHub 401 on /repos/x/y/issues' }),
    }),
  );

  await page.getByRole('button', { name: 'Give feedback' }).click();
  await page.getByPlaceholder(/what happened/i).fill('Anything.');
  await page.getByRole('button', { name: 'Send feedback' }).click();

  await expect(page.getByText(/GitHub rejected/i)).toBeVisible();
});
