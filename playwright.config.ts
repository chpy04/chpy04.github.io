import { defineConfig, devices } from '@playwright/test';

/**
 * E2E against a real dev server and a real Postgres. Assumes
 * `docker compose up -d db` is already running. `globalSetup` force-reseeds
 * the database; `webServer` starts Next.
 *
 * `APP_AUTH_MODE=password` is set explicitly: the browser suite drives the
 * real login screen, so it must not pick up the `dev` default that local
 * development uses. Dev mode — where there is no login screen and the
 * session is the seeded user — is covered in-process by `lib/session.test.ts`
 * instead of a second server here, because two concurrent `next dev`
 * processes cannot share a build directory and splitting them makes Next
 * rewrite `tsconfig.json`/`next-env.d.ts` on every run.
 *
 * `npm run test:e2e` runs this through `node --env-file-if-exists=.env` so
 * that `.env` reaches both halves. Next would read it for the server either
 * way, but `e2e/uploads.spec.ts` decides in *this* process whether storage
 * is configured, and the two disagreeing means the upload test skips on a
 * machine that could have run it.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  globalSetup: './e2e/global-setup.ts',
  webServer: {
    // A single process, deliberately. A compound shell command
    // (`seed && next dev`) means Playwright's teardown kills the shell while
    // next-server survives, leaving :3100 occupied and failing the next run.
    // Seeding lives in e2e/global-setup.ts instead.
    command: 'next dev --port 3100',
    // `/`, not `/login`: this probe is also what warms the dev server's
    // per-route compilation, and every spec starts with `goto('/')`. Probing
    // a route the tests don't use leaves the first test paying a cold compile
    // inside its own timeout.
    url: 'http://localhost:3100/',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://app:app@localhost:5434/app',
      APP_PASSWORD: 'e2e-password',
      AUTH_SECRET: 'e2e-secret',
      APP_AUTH_MODE: 'password',
      // Listed rather than left to inheritance so this block stays the whole
      // answer to "what is this server configured with". Absent is a valid
      // state: the upload spec skips and every other spec is unaffected.
      ...(process.env.SUPABASE_URL ? { SUPABASE_URL: process.env.SUPABASE_URL } : {}),
      ...(process.env.SUPABASE_SERVICE_ROLE_KEY
        ? { SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY }
        : {}),
    },
  },
});
