import { execFileSync } from 'node:child_process';

/**
 * Force-reseeds the database once, before the suite starts.
 *
 * This is deliberately not the first half of `webServer.command`. A compound
 * shell command ("seed && next dev") means Playwright's teardown kills the
 * shell while `next dev`'s own `next-server` child survives — every
 * interrupted run then leaves a server squatting on :3100 and the next run
 * fails with "port is already used". Keeping `webServer.command` a single
 * process lets Playwright manage its lifetime properly.
 */
export default function globalSetup(): void {
  execFileSync('node', ['--experimental-strip-types', 'scripts/seed.ts', '--force'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://app:app@localhost:5434/app',
    },
  });
}
