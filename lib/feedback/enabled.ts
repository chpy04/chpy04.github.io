/**
 * Is the feedback widget part of *this* deployment?
 *
 * It is a development tool: it exists so that "that looks wrong" can become
 * a filed report without leaving the page. On the public portfolio it would
 * be a button offering strangers a way to open issues on the owner's repo,
 * so it ships only where the owner is the only person who can reach it.
 *
 * The default is "anywhere that is not Vercel". `VERCEL` is set by the
 * platform during both build and runtime, which makes it a more honest test
 * than `NODE_ENV`: a local `next build && next start` is still local, and
 * the point of running it is to check the thing you are about to deploy.
 *
 * `FEEDBACK_ENABLED` overrides in both directions — set it to `true` on a
 * preview deployment you want reports from.
 *
 * Pure `process.env`, no Node builtins, so a server component can call it
 * and pass the answer down as a prop rather than the browser having to ask.
 */
export function isFeedbackEnabled(): boolean {
  const raw = process.env.FEEDBACK_ENABLED?.trim().toLowerCase();
  if (raw === 'true' || raw === '1') return true;
  if (raw === 'false' || raw === '0') return false;

  return !process.env.VERCEL;
}
